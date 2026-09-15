# 📚 Documentación Técnica — Love Arcade
### Plataforma de Recompensas · v14.3 Daily Streak Hub · v14.2 Floating Pill Navigation · v14.0 Gatekeeper Security & UX Refactor · v13.0 Sentinel Cloud Sync · v12.1 Body Parser Hardening · v12.0 Telegram Proxy & Secure Telemetry · Shadow-Gate · Hardening & Error Detection · Ghost Analytics v12.1 · Word Hunt Progression Metrics · Mobile Performance Pass · CDN Offline Resilience

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
1a. [Arquitectura vigente de Tienda](#1a-arquitectura-vigente-de-tienda)
2. [Novedades en v8.0](#2-novedades-en-v80)
2b. [Novedades en v8.1](#2b-novedades-en-v81--daily-claim-security--ux-hardening)
2c. [Novedades en v9.0 — SPA Migration](#2c-novedades-en-v90--spa-migration--performance)
2d. [Novedades en v9.1 — History API, Retry UI & Theme Fix](#2d-novedades-en-v91--history-api-retry-ui--theme-fix)
2e. [Novedades en v9.2 — Font FOIT/FOUT, Coin Init & Treasury Grid](#2e-novedades-en-v92--font-foitfout-coin-init--treasury-grid)
2f. [Novedades en v9.3 — Zero-Flicker Initiative](#2f-novedades-en-v93--zero-flicker-initiative)
2g. [Novedades en v9.4 — Identity Update](#2g-novedades-en-v94--identity-update)
2h. [Novedades en v10.0 — Arcade Solid 3.0](#2h-novedades-en-v100--arcade-solid-30)
2j. [Novedades en v10.2 — Preview 2.0 Sistema de Mockup Dinámico](#2j-novedades-en-v102--preview-20-sistema-de-mockup-dinámico)
2k. [Novedades en v9.5 — Cloudinary CDN Migration](#2k-novedades-en-v95--cloudinary-cdn-migration)
2l. [Novedades en v9.6 — CDN Offline Resilience](#2l-novedades-en-v96--cdn-offline-resilience)
2m. [Novedades en v9.6 — SVG Sprite Migration](#2m-novedades-en-v96--svg-sprite-migration-fase-1--icon-performance)
2n. [Novedades en v9.6 — Smart Preload (Fase 2)](#2n-novedades-en-v96--smart-preload-fase-2--intersection-observer)
2o. [Novedades en v9.6 — Animación de Modal (Fase 3)](#2o-novedades-en-v96--animación-de-modal-fase-3--scale-opacity)
2p. [Novedades en v9.6 — Neon Flow Fallback (Fase 4)](#2p-novedades-en-v96--neon-flow-fallback-fase-4--gpu-animated-gradients)
2q. [Novedades en v9.7 — Smart Preload Hardening](#2q-novedades-en-v97--smart-preload-hardening-decoding-async--scheduler--connection-guard)
2r. [Novedades en v9.8 — Mobile Performance Pass](#2r-novedades-en-v98--mobile-performance-pass-scroll--modal-lag)
2s. [Novedades en v9.9 — Ghost Analytics](#2s-novedades-en-v99--ghost-analytics)
2t. [Novedades en v9.9.1 — Ghost Analytics: producción](#2t-novedades-en-v991--ghost-analytics-producción)
2u. [Novedades en v9.9.2 — Hardening & Error Detection](#2u-novedades-en-v992--hardening--error-detection)
2v. [Novedades en v10.0 — Shadow-Gate Developer Filter](#2v-novedades-en-v100--shadow-gate-developer-filter)
2y. [Novedades en v11.5 — Performance & Accessibility Audit](#2y-novedades-en-v115--performance--accessibility-audit)
2z. [Novedades en Ghost Analytics v11.0 — Doble Candado (Anti-Bot + Human Gate)](#2z-novedades-en-ghost-analytics-v110--doble-candado-anti-bot--human-gate)
2aa. [Novedades en v11.1 — Word Hunt: Métricas de Progresión](#2aa-novedades-en-v111--word-hunt-métricas-de-progresión)
2ab. [Novedades en v12.0 — Infraestructura de Telemetría Segura (Telegram Proxy)](#2ab-novedades-en-v120--infraestructura-de-telemetría-segura-telegram-proxy)
2ac. [Novedades en v12.1 — Body Parser Hardening (Bugfix)](#2ac-novedades-en-v121--body-parser-hardening-bugfix)
2ad. [Novedades en v13.0 — Sentinel Cloud Sync (Supabase)](#2ad-novedades-en-v130--sentinel-cloud-sync-supabase)
2ae. [Novedades en v14.0 — Gatekeeper Security & UX Refactor](#2ae-novedades-en-v140--gatekeeper-security--ux-refactor)
2af. [Novedades en v14.1 — Gestión robusta de cuota localStorage y avatares](#2af-novedades-en-v141--gestión-robusta-de-cuota-localstorage-y-avatares)
2ag. [Novedades en v14.2 — Floating Pill Navigation](#2ag-novedades-en-v142--floating-pill-navigation)
2ah. [Daily Streak Hub Redesign (Fire Widget)](#2ah--daily-streak-hub-redesign-fire-widget)
3. [Arquitectura del Proyecto](#3-arquitectura-del-proyecto)
4. [Estructura de Archivos](#4-estructura-de-archivos)
5. [app.js — El Motor](#5-appjs--el-motor)
6. [sync-worker.js — Web Worker](#6-sync-workerjs--web-worker)
7. [shop.json — El Catálogo](#7-shopjson--el-catálogo)
8. [index.html — SPA Unificada](#8-indexhtml--spa-unificada)
9. [js/shop-logic.js — Módulo de Tienda](#9-jsshop-logicjs--módulo-de-tienda)
10. [js/spa-router.js — Router SPA](#10-jsspa-routerjs--router-spa)
11. [styles.css — Sistema de Diseño Mobile-First](#11-stylescss--sistema-de-diseño-mobile-first)
12. [Códigos Promocionales (SHA-256)](#12-códigos-promocionales-sha-256)
13. [Sistema de Racha (Streaks)](#13-sistema-de-racha-streaks)
14. [Bendición Lunar](#14-bendición-lunar)
16. [Sincronización con BackupEngine (.labak)](#16-sincronización-con-backupengine-labak)
17. [Historial de Transacciones](#17-historial-de-transacciones)
18. [Flujos de Usuario](#18-flujos-de-usuario)
19. [Guía de Mantenimiento](#19-guía-de-mantenimiento)
20. [Seguridad y Limitaciones](#20-seguridad-y-limitaciones)
21. [Compatibilidad](#21-compatibilidad)
22. [Glosario](#22-glosario)

---

> **Nota de vigencia documental:** las secciones de "Novedades" son un **archivo histórico**. Pueden describir filtros, regalos, banners, mockups o una Biblioteca que ya no forman parte de la arquitectura vigente. Para la Tienda actual, prevalece la sección **1a** y las secciones 7, 9 y 12 actualizadas en este documento.

## 1a. Arquitectura vigente de Tienda

La Tienda usa una única fuente publicada: `data/shop.json`. Cada entrada conserva un `id` numérico estable, `name`, `price`, `category: "art"`, `type`, e `imageUrl`; los elementos `type: "file"` añaden `downloadUrl`. El contrato no admite `tags`, `file`, `requirements` ni `category: "gift"`.

`imageUrl` guarda la URL Cloudinary original, sin transformaciones. `shop-logic.js` deriva al vuelo las miniaturas de Tienda, Colección y el preview con `f_avif,q_auto,c_fill,g_auto`, relación de aspecto y ancho apropiados; por tanto, estas vistas solicitan AVIF explícitamente y no usan la negociación automática de formato de `f_auto`. Ante una URL no reconocida conserva la fuente como fallback. Para descargar un elemento `image` poseído, deriva `fl_attachment`; para `file`, usa su `downloadUrl` directo.

La interfaz tiene dos vistas explícitas. **Tienda** muestra únicamente ítems no poseídos y un grid visual de dos railes. **Colección** muestra únicamente ítems poseídos, se monta al abrirse por primera vez y contiene la única búsqueda local por nombre; no hace fetch adicional. La apertura de una tarjeta usa delegación de Pointer Events para distinguir un tap de un scroll.

El preview es un diálogo ligero. La confirmación muestra el precio original, el descuento cuando hay oferta, el cashback cuando aplica y el **Total** tras descuento. `GameCenter.buyItem()` sigue siendo la autoridad para saldo, cashback, inventario, historial y sincronización. Tras una compra, el ítem desaparece de Tienda y Colección se actualiza solo si ya está montada.

Las promociones se canjean exclusivamente desde **Perfil → Códigos promocionales**, mediante `GameCenter.redeemPromoCode()`. La Tienda no contiene filtros, búsqueda global, tabs, regalos, carruseles, autoplay ni banner global de oferta.

Las verificaciones de contrato y de arquitectura viven en `tests/shop-catalog-static-qa.mjs`; deben ejecutarse antes de publicar cambios de catálogo o de la Tienda.

## 1. Visión General

Love Arcade es una **plataforma de recompensas sin backend** construida con HTML, CSS y JavaScript vanilla. Funciona como un sistema de fidelización gamificado: el usuario gana monedas virtuales jugando minijuegos o canjeando códigos, y las utiliza para desbloquear wallpapers en la tienda.

**Principios de diseño:**

- **Sin servidor.** Todo el estado vive en `localStorage`. No hay llamadas a APIs externas salvo la verificación de tiempo (`timeapi.io` → `worldtimeapi.org` como fallback).
- **Mobile-First.** Los estilos base en `styles.css` corresponden a pantallas móviles. Los overrides para desktop se definen con `@media (min-width: 768px)`.
- **Arquitectura SPA.** A partir de v9.0, toda la plataforma es una Single Page Application. `index.html` es el único archivo HTML; `shop.html` ha sido eliminado. La navegación entre vistas no provoca recargas.
- **Separación de responsabilidades.** `app.js` (núcleo), `shop-logic.js` (tienda) y `spa-router.js` (navegación) son módulos independientes con responsabilidades estrictamente delimitadas.
- **Compatibilidad retroactiva.** La función `migrateState()` garantiza que ningún usuario pierda datos al actualizar.
- **Configuración centralizada.** `ECONOMY`, `THEMES`, `CONFIG` y `PROMO_CODES_HASHED` están al inicio de `app.js`.

---

## 2. Novedades en v8.0

| Área | Cambio |
|---|---|
| **CSS** | Reescrito con arquitectura Mobile-First. Los estilos base aplican a móvil; los overrides de desktop usan `@media (min-width: 768px)`. |
| **UI Móvil** | El "Hero Balance" (banner grande de monedas) se oculta en móvil mediante `display: none` en el CSS base. El saldo ya es visible en la Navbar superior. |
| **UI Móvil** | La grilla de productos en la tienda usa `repeat(2, 1fr)` como base (2 columnas en móvil), en lugar de 1 columna. |
| **Iconografía** | Todos los emojis funcionales (`🌙`, `⚡`, `♥`) han sido reemplazados por `<svg class="icon"><use href="#icon-NAME">`. Los iconos se sirven desde un SVG Sprite estático definido en `index.html` (v9.6). |
| **Filtros** | Los filtros del catálogo se simplifican a: Todos, PC y Mobile. Se eliminan Anime, Gaming, Sonic, DragonBall y Genshin. |
| **Sync** | Exportación: migrada a archivo binario comprimido `.labak` (`gzip`) con checksum SHA-256. Se descarga automáticamente sin portapapeles. |
| **Sync** | Importación: usa `<input type="file" accept=".labak,.gz">`, descompresión (`DecompressionStream`) y validación de integridad previa a restaurar `localStorage`. Estándar actual: `.labak`; legado compatible en importación: `.labak.gz`. |
| **Economía** | Sin cambios. `saleMultiplier` y `cashbackRate` se mantienen intactos. |
| **LocalStorage** | Sin cambios. La clave `gamecenter_v6_promos` permanece igual. |

---

## 2b. Novedades en v8.1 — Daily Claim Security & UX Hardening

| Área | Cambio |
|---|---|
| **Tiempo de red** | `_syncTimeBackground()` consulta `timeapi.io` y `worldtimeapi.org` en paralelo (background). `_readTimeCache()` lee el caché de forma síncrona en el momento del reclamo — sin red, sin espera. |
| **Reloj desincronizado** | Si la discrepancia entre red y reloj local supera 5 minutos, el reclamo se bloquea con el mensaje "Reloj desincronizado". |
| **Lógica de día** | Sustituido el contador de 24 h exactas por **días calendario**. El bono está disponible a las 00:00:00 del día siguiente al último reclamo. |
| **Fórmula de racha** | `diffDays === 1` → streak+1 · `diffDays > 1` → reset a 1 · `diffDays === 0` → ya reclamado. Calculado con `setHours(0,0,0,0)` para comparar medianoche contra medianoche. |
| **Race condition** | El botón `#btn-daily` se pone a `disabled = true` de forma **síncrona** antes de cualquier `await`, evitando múltiples reclamos por doble clic. |
| **Feedback visual** | El texto del botón cambia a `"Procesando..."` mientras la Promise está pendiente. Se restaura por `updateDailyButton()` al finalizar. |
| **Saltos negativos** | Si `currentTime < lastClaimTime` (manipulación de reloj), se bloquea el reclamo y se muestra un mensaje informativo. La racha no se reinicia. |
| **Tolerancia de red** | `claimDaily()` no depende de la red en tiempo de ejecución. La Bendición Lunar se concede siempre que el buff esté activo. Solo se bloquea si `desynced: true` en el caché (reloj adelantado detectado en el último sync). |

---

## 2c. Novedades en v9.0 — SPA Migration & Performance

| Área | Cambio |
|---|---|
| **Arquitectura** | `index.html` y `shop.html` fusionados en una única SPA. `shop.html` eliminado. |
| **Navegación** | Cero recargas de página. El router SPA alterna `display:none` entre `#view-home` y `#view-shop`. |
| **Modales** | `#preview-modal`, `#confirm-modal` y `#email-modal` movidos al final de `<body>`, fuera de `<main>`. Soluciona el bug de scroll gigante. |
| **Separación JS** | Toda la lógica de tienda extraída de `shop.html` al módulo independiente `js/shop-logic.js`. |
| **SPA Router** | Nuevo módulo `js/spa-router.js` gestiona navegación, scroll y sincronización de saldo. |
| **Saldo sincronizado** | `window.GameCenter.syncUI()` garantiza que Navbar y HUD muestren el mismo saldo al cambiar de vista. |
| **Animaciones GPU** | `will-change: transform, opacity` aplicado a `.shop-card` para compositing acelerado por GPU. |
| **Confetti optimizado** | `fireConfetti()` verifica `document.hidden` y la vista activa antes de disparar. Evita renders invisibles. |
| **Carga única del catálogo** | `fetch('data/shop.json')` se ejecuta una sola vez en `DOMContentLoaded`. El resultado se guarda en `allItems`. No hay refetch al cambiar de vista. |
| **`getState()`** | Nueva API pública en `GameCenter`. Devuelve lectura segura del store sin exponer la referencia interna. |
| **`syncUI()`** | Nueva API pública en `GameCenter`. Fuerza sincronización visual completa del saldo desde cualquier módulo. |
| **Limpieza del DOM** | Los toasts usan `.remove()` tras su animación. Los listeners de modales no se duplican (registrados solo en `DOMContentLoaded`). |

---

## 2d. Novedades en v9.1 — History API, Retry UI & Theme Fix

| Área | Cambio |
|---|---|
| **History API** | `spa-router.js` ahora llama a `history.pushState()` en cada transición de vista. El botón Atrás del navegador/móvil vuelve a la vista anterior sin recargar. |
| **Popstate handler** | `window.addEventListener('popstate')` restaura la vista desde `e.state.viewId` usando `_applyView()` (sin nuevo pushState, evitando bucle). |
| **Estado inicial** | `history.replaceState({ viewId:'home' })` al cargar garantiza que la primera entrada del historial sea válida. |
| **Retry UI** | `#shop-error-state` añadido en `index.html` dentro de `#tab-catalog`. Se muestra si `fetch('data/shop.json')` falla con mensaje de error y botón `#btn-retry-shop`. |
| **`loadCatalog()`** | Función encapsulada en `shop-logic.js`. Maneja loading, error, y reintento. El botón Reintentar la llama de nuevo. El listener del retry usa `dataset.bound` para no duplicarse. |
| **`applyTheme()` refactorizado** | Elimina todas las clases `theme-*` del `<body>` y añade la nueva (`theme-violet`, `theme-pink`, etc.). Esto garantiza que el cambio sea inmediato y visible en toda la SPA. |
| **`<body class="theme-violet">`** | El `<body>` arranca con la clase del tema por defecto para evitar un flash sin tema antes de que `app.js` cargue. |
| **Listener `.theme-btn` unificado** | Eliminado el registro duplicado en `app.js`. El único listener vive en `shop-logic.js` DOMContentLoaded. `setTheme()` de `app.js` sigue siendo la fuente de verdad para el store y la visual. |
| **`styles.css`** | Nuevas reglas `.shop-error-state`, `.shop-error-title` y `.shop-error-desc` para el estado de error de red. |

---

## 2e. Novedades en v9.2 — Font FOIT/FOUT, Coin Init & Treasury Grid

### Problema 1 — FOIT/FOUT: Salto de tipografía

| Archivo | Cambio |
|---|---|
| `index.html` | `<link rel="preconnect">` a `fonts.googleapis.com` y `fonts.gstatic.com` antes del stylesheet. Reduce el tiempo de handshake TCP/TLS para la descarga de fuentes. |
| `styles.css` | Dos bloques `@font-face` con `src: local('Arial')` y propiedades `size-adjust`, `ascent-override`, `descent-override` para Exo 2 y DM Sans. Cuando la web font aún no ha cargado, el navegador usa Arial escalada a las mismas métricas verticales, minimizando el reflow visible. |
| `styles.css` | `--font-display` y `--font-body` actualizados con stacks explícitos: `'Exo 2', Arial, system-ui, sans-serif`. |

El `&display=swap` del `@import` de Google Fonts ya estaba presente desde v9.0; esta entrega complementa el mecanismo con fallback de métricas ajustadas.

### Problema 2 — Brinco en contador de monedas (> 10k)

**Causa raíz:** `animateValue` con `start === end` escribía el valor crudo (`store.coins`) en todos los `.coin-display`, sobreescribiendo el texto formateado `"12.5k"` recién pintado.

**Flujo corregido en `app.js` DOMContentLoaded:**

```
1. applyTheme(store.theme)           // tema antes del primer paint
2. _displayedCoins = store.coins     // fijar base sin delta
3. navbar .coin-display → formatCoinsNavbar(store.coins)  // SÍNCRONO
4. otros .coin-display  → store.coins                     // SÍNCRONO
5. requestAnimationFrame → .coin-badge--visible           // fade-in 150ms
6. updateUI()                        // avatar, botón daily, luna…
```

`updateUI()` ahora detecta `_displayedCoins === store.coins` y escribe los valores formateados directamente sin pasar por `animateValue`, evitando el sobreescrito. La animación numérica solo ocurre cuando hay un delta real (ej. al ganar monedas jugando).

**CSS:**

```css
.coin-badge           { opacity: 0; transition: opacity 150ms ease; }
.coin-badge--visible  { opacity: 1; }
```

### Problema 3 — Desborde en "Mis Tesoros" (móvil < 380px)

**Causa:** `#library-container` heredaba `.shop-grid` con `grid-template-columns: repeat(2, 1fr)`. En pantallas muy estrechas, las tarjetas con padding se salían del viewport.

**Solución:** nueva clase `.treasury-grid` añadida junto a `.shop-grid` en `#library-container`:

```css
.treasury-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    justify-content: center;
}
@media (max-width: 320px) {
    .treasury-grid { grid-template-columns: 1fr; }
}
```

`box-sizing: border-box` ya era global desde el reset; no requirió cambios adicionales.

---

## 2f. Novedades en v9.3 — Zero-Flicker Initiative

Esta entrega elimina los tres tipos de parpadeo (FOUC / Hydration Gap) que afectaban a la experiencia de carga.

### Causa Raíz

La "inteligencia" de la página (JavaScript) se ejecutaba demasiado tarde. El navegador pintaba el HTML estático con el **tema violeta, 0 monedas y avatar vacío**, y solo cuando DOMContentLoaded se disparaba, JS corregía esos valores. El usuario percibía un parpadeo de colores, un salto de contador y un destello del avatar por defecto.

### Fix A — Theme Flash (salto de color al cargar)

**Archivo:** `index.html`

**Causa:** `<body class="theme-violet">` hardcodeado. El navegador pintaba la web en violeta y milisegundos después JS cambiaba la clase al tema real del usuario.

**Solución:** Script crítico inline en `<head>`, que se ejecuta síncronamente **antes del primer layout/paint**.

```html
<!-- En <head>, antes del script crítico de tema -->
<script>
!function(){
  var KEY='gamecenter_v6_promos';
  var T={
    violet: ['#9b59ff','rgba(155,89,255,0.4)'],
    pink:   ['#ff59b4','rgba(255,89,180,0.4)'],
    // ...
  };
  try {
    var theme = JSON.parse(localStorage.getItem(KEY)||'{}').theme;
    if(!theme||!T[theme]||theme==='violet') return; // violeta ya es el default en :root
    var d=document.documentElement, accent=T[theme][0], glow=T[theme][1];
    d.style.setProperty('--accent', accent);
    // ... (6 custom properties)
    d.setAttribute('data-theme', theme);
  } catch(e) {}
}();
</script>
```

El tag `<body>` ya **no tiene clase hardcodeada**. `applyTheme()` en app.js sigue añadiendo `theme-{key}` al body síncronamente (defensa en profundidad).

### Fix B — Coin Jitter y State Sync Gap

**Archivo:** `app.js`

**Causa:** El bloque `DOMContentLoaded` esperaba a que *todo* el documento terminara de cargar para ejecutar `applyTheme()`, `updateDailyButton()`, etc. En ese intervalo el usuario veía los valores por defecto del HTML.

**Solución:** Mover TODO el trabajo visual fuera de `DOMContentLoaded` a ejecución **síncrona** al final del `<body>`. Como `app.js` está posicionado al final de body, el DOM ya existe, pero el navegador NO ha pintado todavía (las scripts síncronas bloquean el render).

```
Antes (v9.2):          DOMContentLoaded → applyTheme → init saldo → revealUI
Ahora (v9.3):          Script síncrono → applyTheme → init saldo → revealUI
                        DOMContentLoaded → solo registra event listeners
```

| Función movida a sync | Efecto |
|---|---|
| `applyTheme()` | Tema correcto antes del primer pixel (defensa en profundidad del Fix A) |
| Init de `.coin-display` | Nunca muestra "0" |
| `updateDailyButton()` | Botón diario en estado correcto desde el primer frame |
| `updateMoonBlessingUI()` | Badge lunar correcto desde el primer frame |
| `applyAvatar()` | Avatar real antes del primer paint |
| `revealUI()` | Fade-in de `.coin-badge` y `.hud-avatar-wrap` |

### Fix C — Avatar Wrap Flash

**Archivo:** `styles.css`

**Causa:** `.hud-avatar-wrap` era visible inmediatamente con el avatar por defecto (`https://res.cloudinary.com/dyspgn0sw/image/upload/default_avatar.avif`) antes de que JS aplicara la imagen guardada.

**Solución:**

```css
.hud-avatar-wrap {
    opacity: 0;
    transition: opacity 100ms ease;
}
.hud-avatar-wrap.is-ready {
    opacity: 1;
}
```

`revealUI()` en app.js añade `.is-ready` al hud-avatar-wrap en el siguiente `requestAnimationFrame`, garantizando que el avatar real (o el placeholder si no hay guardado) ya esté cargado antes de revelarse.

### Resumen de archivos modificados

| Archivo | Cambio |
|---|---|
| `index.html` | Script crítico inline en `<head>` + eliminar `class="theme-violet"` del `<body>` |
| `app.js` | INIT síncrono fuera de DOMContentLoaded + nueva función `revealUI()` |
| `styles.css` | `.hud-avatar-wrap { opacity: 0 }` + `.hud-avatar-wrap.is-ready { opacity: 1 }` |

---

## 2g. Novedades en v9.4 — Identity Update

### Visión General

Permite al usuario elegir un **nickname** (máx. 15 chars) y su **género de saludo** (`o` / `a` / `@`) en su primer acceso, con persistencia en `localStorage`. La implementación es compatible con la Zero-Flicker Initiative: el HUD permanece invisible hasta que el estado de identidad está completamente escrito en el DOM.

---

### Esquema de Datos (store)

Dos campos nuevos añadidos a `migrateState()` en `app.js`:

```javascript
nickname: '',    // string, max 15 chars. Vacío = primer acceso.
gender:   '@'    // 'o' | 'a' | '@' — controla el sufijo del saludo.
```

La migración silenciosa valida ambos en stores existentes:

```javascript
if (typeof merged.nickname !== 'string')       merged.nickname = '';
if (!['o','a','@'].includes(merged.gender))    merged.gender   = '@';
```

---

### API Pública (`window.GameCenter`)

| Método | Descripción |
|---|---|
| `setIdentity(nickname, gender)` | Valida, guarda y aplica la identidad. Recorta el nickname a 15 chars. |
| `getIdentity()` | Devuelve `{ nickname, gender }` sin referencia al store. |
| `hasIdentity()` | `true` si `nickname.trim()` no está vacío. |

---

### Función interna `applyIdentity()`

Escribe el nickname y sufijo de género en el DOM **síncronamente** antes de `revealUI()`:

```javascript
function applyIdentity() {
    document.getElementById('pref-suffix').textContent   = store.gender   || '@';
    document.getElementById('display-nickname').textContent = store.nickname || '';
}
```

Se llama en el bloque INIT síncrono de `app.js`, justo después de `applyAvatar()`.

---

### HUD Dinámico (`index.html`)

La identidad visible del HUD se presenta en una fila compacta dentro del Daily Streak Hub:

```html
<p class="hub-identity-row__name">
    Hola, <span id="display-nickname"></span>
</p>
```

`applyIdentity()` sigue actualizando `#display-nickname` de forma síncrona antes de `revealUI()`. El campo opcional `#pref-suffix` se consulta de forma defensiva para compatibilidad con el perfil, pero ya no forma parte del markup del HUD.

---

### Flujo Zero-Flicker (pipeline de ejecución)

```
app.js (síncrono):
  applyTheme()  →  init saldo  →  updateDailyButton()  →  applyAvatar()  →  applyIdentity()
                                                                                    │
                                                              nickname en store?
                                                             ┌──────┴──────┐
                                                            SÍ            NO
                                                             │              │
inline script (síncrono):                                    │              │
  updateStreakBar()  →  updateCountdownDisplay()              │              │
                                                             │              │
  GameCenter.hasIdentity()?                                  │              │
    └─ true  → revealUI()  ◄────────────────────────────────┘              │
    └─ false → mostrar Identity Modal ◄────────────────────────────────────┘
                    │
                    │ (usuario confirma)
                    ▼
              setIdentity() → applyIdentity() → modal.hidden → revealUI()
```

El `.player-hud` permanece en `opacity: 0` en **ambos caminos** hasta el `revealUI()` final.

---

### Identity Modal

- **Activación:** aparece síncronamente si `hasIdentity()` es `false`. No usa `DOMContentLoaded`.
- **Overlay especial:** `.identity-modal-overlay` con `backdrop-filter: blur(12px) brightness(0.45)` y `z-index: 10500`.
- **Chips de género:** grid de 3 botones con animación `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- **Input:** `font-family: var(--font-display)`, contador de chars en tiempo real, validación con mensaje inline.
- **Teclado móvil:** `max-height: 90dvh` + `overflow-y: auto` en `.identity-modal-box`. Al hacer focus en el input, el botón "Empezar" hace `scrollIntoView` para quedar visible por encima del teclado.
- **Confirmación:** click en botón o tecla `Enter`. Valida que el nickname no esté vacío antes de guardar.

---

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `app.js` | `migrateState`: +`nickname`, +`gender`. `GameCenter`: +`setIdentity`, +`getIdentity`, +`hasIdentity`. Nueva función `applyIdentity()`. INIT síncrono: llama a `applyIdentity()`. |
| `index.html` | HUD: `hud-greeting` con `<span id="pref-suffix">`, `hud-name` con `id="display-nickname"`. Identity Modal completo. Inline script: lógica condicional `hasIdentity → revealUI / modal`. |
| `styles.css` | `.identity-modal-overlay`, `.identity-modal-box`, `.identity-chips`, `.identity-chip`, `.identity-chip--active`, `.identity-input`, `.identity-char-count`, `.identity-input-error`, `.identity-confirm-btn`. `.hud-name`: +`min-height`. |

---

## 2k. Novedades en v9.5 — Cloudinary CDN Migration

### Resumen

Se eliminan las carpetas locales `assets/product-thumbs/` y `assets/cover/` del proyecto. Todas las imágenes de producto y carátulas de juegos se sirven desde Cloudinary, lo que reduce el peso del repositorio, mejora los tiempos de carga con transformaciones on-the-fly y unifica el pipeline de imágenes en un único origen.

### Cambios por archivo

| Archivo | Cambio |
|---|---|
| `data/shop.json` | El campo `image` de cada producto ya no apunta a `assets/product-thumbs/`. Ahora es una URL Cloudinary con `ar_16:9,c_fill,g_auto,w_640`. |
| `index.html` | Las carátulas de juegos (`card-cover`) del catálogo principal ahora usan rutas locales en `assets/images/games/cover/*.avif` (sin Cloudinary). |
| `js/app.js` | `getDownloadUrl()` ahora devuelve la URL maestra de Cloudinary sin extensión ni transformaciones: `https://res.cloudinary.com/dyspgn0sw/image/upload/{public_id}`. |
| `js/shop-logic.js` | Nueva función privada `_getMockupUrl(item)`. `openPreviewModal()` usa `_getMockupUrl()` en lugar de `CONFIG.wallpapersPath + item.file`. |

---

### Estructura de URLs Cloudinary

| Uso | Transformación | Ejemplo |
|---|---|---|
| **Thumbnail del catálogo** | `f_auto,q_auto,ar_16:9,c_fill,g_auto,w_640` | `…/f_auto,q_auto,ar_16:9,c_fill,g_auto,w_640/rouge_the_bat_a94a3cca` |
| **Carátula de juego** | `f_auto,q_auto,ar_16:9,c_fill,g_auto,w_1080` | `…/f_auto,q_auto,ar_16:9,c_fill,g_auto,w_1080/2048_cover_art` |
| **Mockup Mobile** | `f_auto,q_auto,ar_9:20,c_fill,w_500` | `…/f_auto,q_auto,ar_9:20,c_fill,w_500/rouge_the_bat_a94a3cca` |
| **Mockup PC** | `f_auto,q_auto,ar_16:9,c_fill,w_1200` | `…/f_auto,q_auto,ar_16:9,c_fill,w_1200/shadow_the_hedgehog_6ff623c4` |
| **Descarga / Email** | *(ninguna — master original)* | `…/rouge_the_bat_a94a3cca` |

> **Nota histórica:** esta tabla describe la migración v9.5. En la arquitectura vigente, las tarjetas de Tienda y Colección y su preview usan `f_avif` explícito; por ello no reciben la negociación automática ni el fallback de formato de `f_auto`. Todas las URLs conservan el **public ID sin extensión**.

---

### `_getMockupUrl(item)` — Detalles de implementación

```javascript
function _getMockupUrl(item) {
    const CDN_BASE = 'https://res.cloudinary.com/dyspgn0sw/image/upload/';
    const tags     = Array.isArray(item.tags) ? item.tags : [];
    const base     = item.file.replace(/\.[^.]+$/, ''); // strip extension → public ID

    if (tags.includes('Mobile')) {
        return `${CDN_BASE}f_auto,q_auto,ar_9:20,c_fill,w_500/${base}`;
    }
    return `${CDN_BASE}f_auto,q_auto,ar_16:9,c_fill,w_1200/${base}`;
}
```

La función es **self-contained**: no depende de `window.CONFIG` ni de ningún estado externo, lo que la hace segura de llamar en cualquier momento del ciclo de vida del módulo.

---

### Flujo de imágenes en el modal de preview (v9.5)

```
openPreviewModal(item)
    │
    ├── Phase 1 (instant)
    │     artEl.style.backgroundImage = item.image   ← thumbnail CDN w_640 (ya en caché)
    │     artEl.classList.add('mockup-bg-loading')   ← estado visual de carga
    │
    └── Phase 2 (async — Image() background load)
          wallpaperPath = _getMockupUrl(item)         ← Mobile:w_500 / PC:w_1200
          hiRes.src = wallpaperPath
                │
                ├─ onload → artEl.backgroundImage = wallpaperPath
                │           artEl.classList → 'mockup-bg-ready'
                └─ onerror → graceful degradation (thumbnail persiste)
```

---

### Guía de mantenimiento actualizada

Para **agregar un wallpaper nuevo** a partir de v9.5:

1. Subir el archivo a Cloudinary. El public ID debe seguir el patrón `{nombre}_{hash8}` (sin extensión en el ID).
2. Añadir la entrada en `data/shop.json`:
   - `"image"`: `https://res.cloudinary.com/dyspgn0sw/image/upload/f_auto,q_auto,ar_16:9,c_fill,g_auto,w_640/{public_id}`
   - `"file"`: nombre del archivo original incluyendo extensión (ej: `rouge_the_bat_a94a3cca.webp`)
   - `"tags"`: debe incluir `"Mobile"` o `"PC"` para que `_getMockupUrl()` seleccione la transformación correcta.
3. No es necesario generar thumbnails locales ni tocar JS o HTML.

---

## 2l. Novedades en v9.6 — CDN Offline Resilience

### Motivación

Con la migración completa a Cloudinary (v9.5), todas las imágenes de la plataforma dependen de un CDN externo. Ante una caída de Cloudinary o un CDN bloqueado por el usuario (ad-blocker, firewall corporativo, región con restricciones), la interfaz mostraba elementos en blanco o el icono de imagen rota del navegador. Esta entrega garantiza que la plataforma nunca se vea "rota", independientemente del estado del CDN.

---

### Escenarios cubiertos

| Escenario | Comportamiento anterior | Comportamiento v9.6 |
|---|---|---|
| CDN caído — modal de preview abierto | Art layer en blanco, shimmer de carga infinito | Gradiente CSS puro (`mockup-bg-offline`) aplicado en <100 ms |
| CDN caído — catálogo | Icono roto del navegador en cada tarjeta | Fondo sólido `.shop-img--offline`, sin icono roto |
| CDN caído — biblioteca | Icono roto del navegador en cada tarjeta | Fondo sólido `.shop-img--offline`, sin icono roto |
| Archivo hi-res faltante, thumbnail OK | Shimmer de carga infinito | Degrada a thumbnail visible (blur → clear) |
| CDN lento — modal abierto antes de cargar | Thumbnail visible con blur hasta hi-res | Sin cambio — comportamiento correcto preservado |

---

### Arquitectura del fallback

#### `_applyArtFallback(artEl)` — `shop-logic.js`

Función privada e idempotente. Limpia el `backgroundImage` del art layer y aplica la clase `.mockup-bg-offline`. Segura de llamar desde múltiples manejadores de error sin efectos secundarios duplicados.

```javascript
function _applyArtFallback(artEl) {
    if (!artEl || artEl.classList.contains('mockup-bg-offline')) return;
    artEl.style.backgroundImage = 'none';
    artEl.classList.remove('mockup-bg-loading', 'mockup-bg-ready');
    artEl.classList.add('mockup-bg-offline');
}
```

#### Flujo completo del modal de preview (v9.6)

```
openPreviewModal(item)
    │
    ├── artEl.backgroundImage = thumbnail CDN    ← inmediato (best-case)
    ├── artEl.classList → 'mockup-bg-loading'
    │
    ├── thumbProbe = new Image(item.image)       ← prueba CDN en paralelo
    │       ├── onload  → _thumbOk = true        ← CDN alcanzable
    │       └── onerror → cancela Phase 2
    │                     _applyArtFallback()    ← gradiente CSS inmediato
    │
    └── hiRes = new Image(_getMockupUrl(item))   ← Phase 2 (hi-res)
            ├── onload  → backgroundImage = hi-res URL
            │             classList → 'mockup-bg-ready'
            │
            └── onerror →
                    ├── _thumbOk = true  → classList remove 'loading', add 'ready'
                    │                      (thumbnail queda como imagen final)
                    └── _thumbOk = false → _applyArtFallback()
```

#### `.mockup-layer-art.mockup-bg-offline` — `styles.css`

Gradiente CSS de doble capa (radial glow + linear base) aplicado sin recursos externos. Los `!important` en `filter` y `transform` anulan los estados `.mockup-bg-loading` que pueden estar activos cuando el error llega antes de que el load resuelva.

```css
.mockup-layer-art.mockup-bg-offline {
    background-image: none !important;
    background:
        radial-gradient(ellipse 65% 55% at 50% 42%,
            rgba(155, 89, 255, 0.09) 0%, transparent 70%),
        linear-gradient(160deg, #0e0c1a 0%, #1a1428 55%, #0c0c18 100%);
    filter: none !important;
    transform: scale(1) !important;
    transition: none;
}
```

#### `onerror` en `<img>` de catálogo y biblioteca

Añadido en `renderShop()` y `renderLibrary()`. El manejador se auto-elimina (`this.onerror=null`) para prevenir bucles de error recursivos, elimina el `src` para suprimir el icono de imagen rota del navegador, y añade `.shop-img--offline` para el fondo de relleno CSS.

```html
<img src="..." class="shop-img"
     onerror="this.onerror=null; this.classList.add('shop-img--offline'); this.removeAttribute('src');">
```

---

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `js/shop-logic.js` | Nueva función `_applyArtFallback(artEl)`. `openPreviewModal()`: Phase 1 añade `thumbProbe` Image + `_thumbOk` closure variable; Phase 2 `onerror` reescrito con lógica condicional. `renderShop()` y `renderLibrary()`: `onerror` inline en `<img>`. |
| `styles.css` | Nuevas clases `.mockup-layer-art.mockup-bg-offline` y `.shop-img--offline`. |

---

## 2m. Novedades en v9.6 — SVG Sprite Migration (Fase 1 — Icon Performance)

### Motivación

`lucide.createIcons()` se ejecutaba en cada transición de vista dentro de `_applyView()` y en cada render parcial del catálogo. En dispositivos de gama media/baja esto generaba un pico de CPU de ~200–500 ms que bloqueaba el hilo principal, causaba reflows por reemplazo de nodos SVG, y producía un parpadeo perceptible donde los iconos "aparecían" un instante después que el resto del contenido.

Adicionalmente, la librería Lucide (~90 KB) se cargaba desde `unpkg.com` en el critical path, añadiendo un round-trip de red innecesario.

### Solución: SVG Sprite Estático

Se reemplaza el sistema dinámico de Lucide por un bloque `<svg>` oculto al inicio del `<body>` que contiene 47 símbolos (`<symbol id="icon-NAME">`). Cada icono se referencia con el patrón nativo:

```html
<!-- Antes (Lucide dinámico) -->
<i data-lucide="shopping-bag" size="20"></i>

<!-- Ahora (SVG Sprite estático) -->
<svg class="icon" width="20" height="20" aria-hidden="true">
    <use href="#icon-shopping-bag"></use>
</svg>
```

El navegador clona cada símbolo vía Shadow DOM interno: sin scripting, sin reflow, pintado atómico desde el primer frame de cada transición.

### Clase CSS `.icon`

Se añade en `styles.css` la clase base `.icon` y variantes para casos de fill explícito:

```css
.icon {
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    pointer-events: none;
}

/* Variantes de fill para iconos con relleno explícito */
.icon--star-filled  { fill: #fbbf24; stroke: none; }  /* precio, coin-badge */
.icon--zap-filled   { fill: currentColor; stroke: none; }  /* sale badge */
```

> **Nota para desarrollo:** Los iconos generados dinámicamente en templates HTML dentro de `shop-logic.js` deben usar el helper `_icon(name, size, opts)` en lugar de la antigua sintaxis `<i data-lucide>`.

### Helper `_icon()` en `shop-logic.js`

```javascript
// Genera markup SVG Sprite para usar en innerHTML de templates
_icon('download', 14)
// → <svg class="icon" width="14" height="14" aria-hidden="true"><use href="#icon-download"></use></svg>

_icon('star', 13, { fill: '#fbbf24', stroke: 'none' })
// → <svg class="icon" width="13" height="13" style="fill:#fbbf24;stroke:none" aria-hidden="true">...

```

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `index.html` | SVG Sprite (47 `<symbol>`) inyectado al inicio del `<body>`. Los 70 nodos `<i data-lucide>` reemplazados por `<svg class="icon"><use>`. `<script src="unpkg.com/lucide">` eliminado. `lucide.createIcons()` inline eliminado. |
| `spa-router.js` | `lucide.createIcons()` eliminado de `_applyView()`. JSDoc actualizado. Versión actualizada a v9.6. |
| `app.js` | 3 llamadas a `lucide.createIcons()` eliminadas (DOMContentLoaded + 2 handlers de avatar upload). |
| `shop-logic.js` | Añadido helper `_icon(name, size, opts)`. Todos los `<i data-lucide>` en template strings reemplazados por `<svg><use>`. Llamadas a `lucide.createIcons()` eliminadas. |
| `styles.css` | Añadida clase `.icon` (stroke base, sin fill) y variantes `.icon--star-filled`, `.icon--zap-filled`, `.icon--heart-filled`. |

### Resultado

| Métrica | Antes | Después |
|---|---|---|
| Coste de scripting por transición | ~200–500 ms (CPU) | 0 ms |
| Round-trips de red para iconos | 1 (CDN Lucide ~90 KB) | 0 |
| Parpadeo de iconos en transición | Visible (~1 frame) | Eliminado |
| Nodos del DOM creados/destruidos | Por cada transición | 0 (sprite cachado) |

---

## 2n. Novedades en v9.6 — Smart Preload (Fase 2 — Intersection Observer)

### Motivación

`openPreviewModal()` era un sistema puramente reactivo: la descarga de la imagen hi-res comenzaba únicamente cuando el usuario hacía clic. En conexiones móviles promedio esto producía ~3 segundos de espera con una miniatura pixelada en pantalla, dañando el impacto visual de la estética Cyber-Vibrant y haciendo que la interfaz se sintiese lenta a pesar de ser técnicamente fluida en el resto.

### Solución: Precarga Predictiva

Se implementa un `IntersectionObserver` que aprovecha el tiempo de lectura/scroll del usuario para descargar el arte hi-res en segundo plano. Cuando el usuario abre el modal, el navegador ya tiene la imagen en caché y la sirve instantáneamente.

### Arquitectura (v9.6 base — ver hardening en v9.7 más abajo)

#### `_preloadItemHiRes(cardEl, item)` — precarga unitaria

```javascript
function _preloadItemHiRes(cardEl, item) {
    if (cardEl.dataset.preloaded) return;
    cardEl.dataset.preloaded = 'true';   // Marcar antes de crear Image() — evita carrera

    const img = new Image();
    img.fetchPriority = 'low';           // No compite con recursos críticos del HUD
    img.decoding      = 'async';         // [v9.7] decodificación fuera del hilo principal
    img.src = _getMockupUrl(item);       // Misma URL que usará openPreviewModal() → cache hit
}
```

- `data-preloaded="true"` se escribe en el card **antes** de instanciar `Image()` para evitar una condición de carrera si el observer dispara dos veces en el mismo frame.
- `fetchPriority = 'low'` (Chrome 101+, Safari 17.2+) asegura que la precarga no compite con el HUD, el saldo ni otros elementos críticos.
- `decoding = 'async'` (v9.7 — ver sección 2q) delega la decodificación de píxeles al thread del compositor, liberando el hilo principal durante ráfagas de scroll.
- Si el CDN devuelve error, `onerror` elimina `data-preloaded` para que `openPreviewModal()` ejecute su propio flujo de fallback CSS.

#### `_initPreloadObserver(container, items)` — configuración del observer

| Parámetro | v9.6 | v9.7 | Razón del cambio |
|---|---|---|---|
| `rootMargin` | `'200px'` | `'200px 0px 400px 0px'` | Anticipación asimétrica: 400 px abajo (scroll principal), 200 px arriba (scroll inverso), 0 px en lados (evita activar overflow horizontal) |
| `threshold` | `0.1` | `0` | Con rootMargin proveyendo el buffer, threshold 0.1 añadía latencia sin precisión. threshold 0 dispara al primer píxel en la zona extendida |

```javascript
_preloadObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const cardEl = entry.target;
        if (cardEl.dataset.preloaded) { _preloadObserver?.unobserve(cardEl); return; }

        const item = itemMap.get(parseInt(cardEl.querySelector('.shop-preview-btn')?.dataset?.id, 10));
        if (item) _schedulePreloadItem(cardEl, item);   // [v9.7] scheduler, no directo

        _preloadObserver?.unobserve(cardEl);
    });
}, { rootMargin: '200px 0px 400px 0px', threshold: 0 });
```

- **Mapa `id → item`**: construido en `O(n)` una sola vez al inicializar el observer; cada lookup en el callback es `O(1)`.
- **`unobserve` inmediato**: tras procesar un card, se deja de observar. El observer no acumula referencias a elementos ya tratados.
- **Solo cards con `.shop-preview-btn`**: las tarjetas compradas no tienen modal de preview y no necesitan precarga.
- **Idempotente**: si `renderShop()` reconstruye el DOM, `_initPreloadObserver()` desconecta el observer anterior y vacía la cola pendiente antes de crear uno nuevo sobre los nodos frescos.

#### Ciclo de vida del observer (integración con SPA)

```
navigateTo('shop')
    └── ShopView.onEnter()
            └── filterItems() → renderShop()
                    └── _initPreloadObserver()   ← Observer activo

[Usuario hace scroll — cards entran en zona extendida]
    └── _schedulePreloadItem()                   ← Encolar
            └── requestIdleCallback / setTimeout ← Despachar en idle
                    └── _preloadItemHiRes()       ← Imagen hi-res en caché

[Usuario hace clic en Preview]
    └── openPreviewModal()                       ← cache hit → swap instantáneo

navigateTo('home')
    └── ShopView.onLeave()                       ← Observer desconectado
            └── _preloadObserver.disconnect()
```

#### Cambios en `spa-router.js`

`_applyView()` ahora llama a `onLeave()` de la vista que se abandona **antes** de activar la nueva:

```javascript
if (viewId === 'shop') window.HomeView?.onLeave?.();
if (viewId === 'home') window.ShopView?.onLeave?.();

if (viewId === 'home') window.HomeView?.refresh?.();
if (viewId === 'shop') window.ShopView?.onEnter?.();
```

### Eficiencia de datos

A diferencia de una precarga masiva, el observer solo descarga imágenes de los cards que el usuario está viendo o está a punto de ver. En un catálogo de 30 items con una pantalla móvil que muestra 4 cards, el máximo de precargas activas en cualquier momento es ~6-8 (los visibles + los dentro del margen).

### Compatibilidad (v9.6 base)

| API | Soporte |
|---|---|
| `IntersectionObserver` | Chrome 51+, Firefox 55+, Safari 12.1+, Edge 15+ |
| `fetchPriority` | Chrome 101+, Safari 17.2+ (ignorado en otros — sin degradación) |

En entornos sin `IntersectionObserver`, `_initPreloadObserver()` retorna inmediatamente y la imagen hi-res se carga al abrir el modal (comportamiento pre-v9.6).

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `js/shop-logic.js` | Nuevas funciones `_preloadItemHiRes()` e `_initPreloadObserver()`. Nueva variable de módulo `_preloadObserver`. `renderShop()` llama a `_initPreloadObserver()` tras construir el DOM. `ShopView` añade método `onLeave()` que desconecta el observer. |
| `js/spa-router.js` | `_applyView()` llama a `onLeave()` de la vista saliente antes de activar la nueva. JSDoc actualizado. |

---

## 2q. Novedades en v9.7 — Smart Preload Hardening (decoding async + scheduler + connection guard)

### Motivación

La Fase 2 (v9.6) del Smart Preload resolvió el problema de latencia al abrir el modal. Sin embargo, tres problemas de rendimiento quedaron sin resolver:

1. **Decodificación síncrona en scroll rápido**: `new Image()` instancia la carga, pero cuando la imagen resuelve, el navegador intenta decodificarla (descomprimir píxeles para la GPU) de forma síncrona en el hilo principal. Con 8-10 precargas resolviendo simultáneamente durante scroll rápido, esto producía micro-congelaciones de 10-40 ms por imagen — imperceptibles individualmente, pero acumuladas provocan jank visible en gama baja.

2. **Sin throttling de red en scroll rápido**: cuando el usuario hace scroll muy rápido, el observer recibe todas las entries de golpe en el mismo callback. Sin cola, se inician N descargas en paralelo, saturando el ancho de banda disponible aunque `fetchPriority = 'low'` esté activo.

3. **Sin respeto al Data Saver**: si el usuario tiene activado el modo de ahorro de datos o tiene conexión slow-2g, la precarga consumía ancho de banda en contra de su preferencia explícita.

### Cambios

#### `img.decoding = 'async'` en la precarga y en `<img.preview-image>`

```javascript
// _preloadItemHiRes(): misma URL de 1200 px que usa el preview
img.fetchPriority = 'low';
img.decoding      = 'async';
img.src           = _getPreviewImageUrl(item);

// _renderPreview() y _renderCollectionItemModal()
image.className = 'preview-image';
image.src = _getPreviewImageUrl(item);
image.decoding = 'async';
```

Ya no existen `thumbProbe` ni `hiRes`, ni hay un swap de `backgroundImage`. La tarjeta usa una transformación adaptada a su ancho, mientras que el preview solicita deliberadamente la variante de 1200 px. La precarga de Tienda solicita esa URL exacta para reutilizar la caché; Colección no se precarga en bloque. El modal se muestra de inmediato y la imagen termina de forma progresiva con una relación de aspecto fija, sin esperar la descarga.

| Contexto | Sin `decoding='async'` | Con `decoding='async'` |
|---|---|---|
| 8 precargas resuelven simultáneamente | Decodificación síncrona ~10-40 ms × 8 = posible congelación | Decodificación diferida; hilo principal disponible |
| Preview de 1200 px | Puede competir con la respuesta visual del modal | El overlay aparece primero y la imagen completa de forma progresiva |

El contrato completo de interacción delegada, la estrategia de URL y las métricas recomendadas están en [`preview-interaction-performance.md`](preview-interaction-performance.md).

Soporte: Chrome 65+, Firefox 63+, Safari 11.1+. Cobertura prácticamente universal.

#### Guard de conexión: `_isDataSaverActive()` e `_isLowBandwidth()`

```javascript
function _isDataSaverActive() {
    const conn = navigator?.connection;
    return conn?.saveData === true || conn?.effectiveType === 'slow-2g';
}

function _isLowBandwidth() {
    return navigator?.connection?.effectiveType === '2g';
}
```

`_initPreloadObserver()` retorna inmediatamente si `_isDataSaverActive()` es `true`. En ese caso no se crea el observer y la imagen se carga al abrir el modal — exactamente el comportamiento pre-v9.6, sin degradación funcional.

La Network Information API es opcional: si el navegador no la soporta (Firefox, Safari < 17.4), ambas funciones devuelven `false` y la precarga procede normalmente.

#### Scheduler de precarga: `_schedulePreloadItem` + `_flushPreloadQueue`

```javascript
// Cola de solicitudes
const _preloadQueue = [];
let   _preloadFlushId = null;

function _schedulePreloadItem(cardEl, item) {
    _preloadQueue.push({ cardEl, item });
    _schedulePreloadFlush();
}

function _schedulePreloadFlush() {
    if (_preloadFlushId !== null) return; // Ya hay despacho programado
    if ('requestIdleCallback' in window) {
        _preloadFlushId = requestIdleCallback(_flushPreloadQueue, {
            timeout: _isLowBandwidth() ? 1200 : 200
        });
    } else {
        _preloadFlushId = setTimeout(
            _flushPreloadQueue,
            _isLowBandwidth() ? 400 : 0
        );
    }
}

function _flushPreloadQueue() {
    _preloadFlushId = null;
    const batchSize = _isLowBandwidth() ? 2 : _preloadQueue.length;
    _preloadQueue.splice(0, batchSize).forEach(({ cardEl, item }) =>
        _preloadItemHiRes(cardEl, item)
    );
    if (_preloadQueue.length > 0) _schedulePreloadFlush();
}
```

| Conexión | Comportamiento del scheduler |
|---|---|
| Data Saver / slow-2g | Observer no se crea; scheduler no se usa |
| 2g | `requestIdleCallback(timeout: 1200ms)` · lote de 2 imágenes · siguiente ciclo tras 400ms |
| 3g / 4g / WiFi | `requestIdleCallback(timeout: 200ms)` · todo el lote de una vez |
| Sin Network Info API | El mismo comportamiento que 3g/4g (fallback conservador) |

La cola se limpia (`_preloadQueue.length = 0`) y el callback pendiente se cancela (`cancelIdleCallback` / `clearTimeout`) cada vez que `_initPreloadObserver()` reconstruye el observer por un nuevo render del catálogo, evitando referencias a nodos DOM obsoletos.

#### `rootMargin` y `threshold` actualizados

| Parámetro | v9.6 | v9.7 |
|---|---|---|
| `rootMargin` | `'200px'` (simétrico) | `'200px 0px 400px 0px'` (asimétrico) |
| `threshold` | `0.1` | `0` |

El nuevo `rootMargin` asimétrico tiene tres efectivos:
- **Superior 200 px**: anticipa el scroll hacia arriba (catálogo ascendente).
- **Inferior 400 px**: zona de precarga principal. ~2 alturas de card en móvil (≈ 1.5 pantallas). En una conexión 4G promedio, una imagen Cloudinary de ~80-150 KB tarda < 0.5 s — el margen de 400 px da ≥ 2 s de anticipación a velocidad de scroll normal.
- **Lados 0 px**: el catálogo es vertical; un margen lateral activaría precargas para cards en overflow horizontal oculto.

`threshold: 0` dispara en cuanto cualquier píxel del card entra en la zona extendida. Con el rootMargin ya proveyendo el buffer, threshold 0.1 solo añadía latencia sin aportar precisión.

### Compatibilidad actualizada

| API | Soporte |
|---|---|
| `IntersectionObserver` | Chrome 51+, Firefox 55+, Safari 12.1+, Edge 15+ |
| `fetchPriority` | Chrome 101+, Safari 17.2+ (ignorado en otros) |
| `img.decoding = 'async'` | Chrome 65+, Firefox 63+, Safari 11.1+ — cobertura universal |
| `requestIdleCallback` | Chrome 47+, Edge 79+, Opera 34+ (fallback: setTimeout) |
| Network Information API | Chrome 61+, Edge 79+, Opera 48+ (fallback: asumir conexión rápida) |

### Resultado

| Escenario | v9.6 | v9.7 |
|---|---|---|
| Scroll rápido, 10 cards entran al mismo tiempo | 10 descargas paralelas, posible jank de decodificación | Cola idle → lote único; decoding async → 0 bloqueo |
| Usuario con Data Saver | Precarga activa (ignora preferencia) | Observer no creado; 0 KB de precarga |
| Usuario con 2g | Hasta 10 descargas simultáneas | Máx. 2 por ciclo idle, siguientes en 400ms |
| openPreviewModal — imagen hi-res | Decodificación puede bloquear hilo | decoding async → swap sin jank |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `js/shop-logic.js` | `_preloadItemHiRes()` y `<img.preview-image>` usan `decoding='async'`; `_getPreviewImageUrl()` mantiene la URL de preview de 1200 px igual a la precargada. Nuevas funciones `_isDataSaverActive()`, `_isLowBandwidth()`, `_schedulePreloadItem()`, `_schedulePreloadFlush()`, `_flushPreloadQueue()`. Nuevas vars de módulo `_preloadQueue`, `_preloadFlushId`. `_initPreloadObserver()`: guard de conexión, cancelación de cola, rootMargin asimétrico, threshold 0, usa `_schedulePreloadItem` en vez de llamada directa. |

---

## 2o. Novedades en v9.6 — Animación de Modal (Fase 3 — Scale + Opacity)

### Motivación

La animación de entrada del modal (`@keyframes modalSlideUp`) combinaba `translateY(20px)` con `scale(0.96)`. El desplazamiento en el eje Y obliga al compositor a rasterizar el contenedor en cada frame del trayecto, ya que las áreas del DOM que quedan "al descubierto" durante el movimiento deben repintarse. En GPUs móviles antiguas sobre pantallas OLED/Retina esto producía caídas de FPS visibles.

### Cambios en `styles.css`

#### `@keyframes modalPopIn` — reemplaza `modalSlideUp`

```css
/* ANTES */
@keyframes modalSlideUp {
    from { transform: translateY(20px) scale(0.96); opacity: 0; }
    to   { transform: translateY(0)    scale(1);    opacity: 1; }
}

/* AHORA */
@keyframes modalPopIn {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1);    }
}
```

`scale` es una multiplicación matricial de vértices en la GPU: no cambia la posición del elemento en el layout, no descubre áreas adyacentes, y no genera repints fuera de los límites de la capa compuesta del propio modal.

El timing function `cubic-bezier(0.34, 1.56, 0.64, 1)` (back-out suave) compensa la ausencia de desplazamiento físico con un rebote leve que da dinamismo orgánico a la aparición.

#### Hardening de `.modal-box`

```css
.modal-box {
    /* ... */
    animation: modalPopIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    will-change: opacity, transform;          /* capa compuesta antes de animar */
    backface-visibility: hidden;              /* previene parpadeo blanco en Safari/iOS */
    -webkit-backface-visibility: hidden;
}
```

- **`will-change`** declarado en CSS sobre `.modal-box`, no en el overlay. La capa compuesta se crea cuando el modal deja de ser `display:none` y se libera automáticamente al volver a `display:none` (vía `.hidden`). No hay coste de memoria en reposo.
- **`backface-visibility: hidden`** previene el artefacto de "parpadeo blanco" que Safari/iOS introduce durante animaciones de `scale` en pantallas de alta densidad al renderizar el lado trasero de la capa.

### Cambios en `shop-logic.js`

Se elimina la gestión manual de `will-change` en JavaScript:

```javascript
// ELIMINADO de openPreviewModal():
modal.style.willChange = 'opacity, transform';

// ELIMINADO de closePreviewModal():
m.style.willChange = 'auto';
```

El CSS toma el control completo del ciclo de vida de la capa compuesta. `closePreviewModal()` solo necesita añadir `.hidden` al overlay.

### Resultado visual

El modal "emerge" desde su centro con un leve rebote, como si brotara de la superficie de la pantalla. El efecto encaja con la estética **Arcade Solid** (hardware táctico) y elimina el artefacto de "deslizamiento desde abajo" que no era coherente con una interfaz de superficie rígida.

| Propiedad | Antes | Después |
|---|---|---|
| Animación | `translateY(20px) → 0` + `scale(0.96) → 1` | `scale(0.95) → 1` + `opacity` |
| Repints por frame | Áreas descubiertas durante desplazamiento | Cero — solo multiplicación matricial |
| `will-change` | Gestionado en JS (set/unset) sobre overlay | Declarado en CSS sobre `.modal-box` |
| `backface-visibility` | Solo en overlay | Overlay **y** `.modal-box` |
| Duración | 0.22s | 0.25s (margen para el rebote back-out) |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `styles.css` | `@keyframes modalSlideUp` → `@keyframes modalPopIn` (sin translateY). `.modal-box`: animación actualizada, `will-change` y `backface-visibility` añadidos. Comentario de `.modal-overlay` actualizado. |
| `shop-logic.js` | `modal.style.willChange = 'opacity, transform'` eliminado de `openPreviewModal()`. `m.style.willChange = 'auto'` eliminado de `closePreviewModal()`. JSDoc de ambas funciones actualizado. |

---

## 2p. Novedades en v9.6 — Neon Flow Fallback (Fase 4 — GPU Animated Gradients)

### Motivación

El fallback de CDN offline (`.mockup-bg-offline`, `.shop-img--offline`) era un gradiente CSS estático. Animar `background-position` o `linear-gradient` directamente requiere re-rasterizar los píxeles en cada frame, generando jank en scroll cuando múltiples tarjetas muestran el fallback simultáneamente. El objetivo es que el modo offline se sienta como un **modo de diseño alternativo**, no como un error.

### Arquitectura: animación por capas

La clave es separar el fondo estático (que no genera trabajo) del efecto de movimiento (que vive en un pseudo-elemento procesado íntegramente por el compositor):

```
.mockup-bg-offline  →  fondo oscuro estático (#07060f)   [cero repints]
      └── ::before  →  conic-gradient 200×200% + blur     [compositor puro]
                        animado con transform (translate + rotate)
```

El pseudo-elemento mide el 200 × 200 % del contenedor y parte posicionado `top:-50%; left:-50%`, de modo que los bordes del gradiente nunca quedan expuestos durante el movimiento.

### `@keyframes neonFlowDrift`

```css
@keyframes neonFlowDrift {
    0%   { transform: translate(0%,   0%)   rotate(0deg);   }
    25%  { transform: translate(-8%,  5%)   rotate(90deg);  }
    50%  { transform: translate(-12%, -4%)  rotate(180deg); }
    75%  { transform: translate(-4%,  8%)   rotate(270deg); }
    100% { transform: translate(0%,   0%)   rotate(360deg); }
}
```

- `translate` + `rotate`: ambas son compositor-only — no calculan layout, no pintan píxeles.
- `8s linear infinite`: ciclo largo para que el movimiento sea imperceptiblemente suave; `linear` elimina aceleraciones/desaceleraciones que delatarían el loop.

### Paleta neón — Cyber-Vibrant + Arcade Solid 3.0

```css
background: conic-gradient(
    from 0deg at 40% 50%,
    #c084fc 0deg,    /* violeta Cyber-Vibrant */
    #4ade80 90deg,   /* verde neón Arcade Solid */
    #818cf8 180deg,  /* índigo mid-tone */
    #c084fc 270deg,
    #4ade80 360deg
);
filter: blur(40px);
opacity: 0.18;       /* modal — sutil sobre fondo oscuro */
```

`filter: blur(40px)` convierte los bordes duros del `conic-gradient` en difusión orgánica, eliminando el banding visible sin coste adicional de rasterizado (blur en pseudo-elemento promocionado es una operación de convolution en GPU).

El ratio de contraste de texto blanco (`#fff`) sobre el fondo base `#07060f` con el orb a `opacity: 0.18` supera 4.5:1 (WCAG AA) en todos los ángulos del ciclo de animación.

### Reglas aplicadas

| Selector | Opacity | Blur | Uso |
|---|---|---|---|
| `.mockup-bg-offline::before` | `0.18` | `40px` | Modal de preview (superficie grande) |
| `.shop-img--offline::before` | `0.14` | `30px` | Cards de catálogo (superficie pequeña, más sutil) |

### Limitación de capas (`will-change`)

`will-change: transform` se declara únicamente en:
- `.mockup-layer-art.mockup-bg-offline` — solo cuando el CDN falla (clase aplicada por JS)
- `.shop-img--offline::before` — solo en imágenes con error (clase aplicada por `onerror`)

En un catálogo cargado correctamente no hay ningún `will-change` extra activo en las tarjetas. La promoción de capas es proporcional al número de fallos reales de CDN, no al tamaño del catálogo.

### Accesibilidad — `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
    .mockup-layer-art.mockup-bg-offline::before,
    .shop-img--offline::before {
        animation-play-state: paused;
    }
}
```

El gradiente permanece visible (modo diseño alternativo) pero el movimiento se detiene para usuarios con vestibular disorders o fotosensibilidad. Complementa la regla global `*::before { animation-duration: 0.01ms !important }` ya existente con una declaración explícita y legible.

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `styles.css` | `.mockup-bg-offline`: fondo estático + `overflow:hidden` + `will-change`. `.mockup-bg-offline::before`: orb neón animado con `neonFlowDrift`. `.shop-img--offline`: misma arquitectura a menor opacidad. `@keyframes neonFlowDrift`. Guard `prefers-reduced-motion` local. |

---

## 2h. Novedades en v10.0 — Arcade Solid 3.0

### Visión General

Rediseño completo del sistema visual de `styles.css`. Se abandona el Glassmorphism genérico (costoso en GPU) en favor de un diseño **Sólido Premium**: superficies oscuras definidas, bordes de acento hard-edge y efectos de movimiento basados en animaciones de capa (no en desenfoque). El resultado es una interfaz que carga más rápido en gama media-baja y transmite robustez táctica.

**Ratio de diseño: 90% Sólido / 10% Glass.**

---

### Cambios en `styles.css`

#### A. Sistema de Tokens — Nuevas Variables de Superficie Sólida

Se eliminan los tokens `--glass-*` como valores transparentes y se redefinen como alias a superficies sólidas. Se añaden tokens `--solid-surface-*` y `--border-*` para el nuevo sistema de jerarquía visual.

```css
/* ANTES — transparencias con blur */
--glass-base-bg:  rgba(255,255,255,0.035);
--glass-float-bg: rgba(255,255,255,0.06);

/* AHORA — superficies sólidas oscuras */
--solid-surface-base:  #0f1018;
--solid-surface-float: #141620;
--solid-surface-hi:    #1a1d2e;
--solid-surface-deep:  #0a0b12;

/* Hard-edge borders (jerarquía por color, no por blur) */
--border-subtle:  rgba(255,255,255,0.06);
--border-mid:     rgba(255,255,255,0.10);
--border-bright:  rgba(255,255,255,0.18);
```

Los tokens `--glass-*` se mantienen en el CSS como alias de compatibilidad para no romper lógica JavaScript que pueda leer CSS custom properties.

---

#### B. Eliminación Masiva de `backdrop-filter`

Todos los `backdrop-filter: blur()` han sido eliminados de los elementos de panel. La jerarquía visual se expresa ahora mediante bordes de acento y sombras cortas sólidas.

| Elemento | Antes | Después |
|---|---|---|
| `.glass-panel` | `backdrop-filter: blur(14px)` | ❌ Eliminado — bg `#0f1018` sólido |
| `.glass-float` | `backdrop-filter: blur(20px)` | ❌ Eliminado — bg `#141620` sólido |
| `.glass-highlight` | `backdrop-filter: blur(24px)` | ❌ Eliminado — bg `#1a1d2e` sólido |
| `.navbar` | `backdrop-filter: blur(24px)` | ❌ Eliminado — bg `#0d0e15` sólido |
| `.bottom-nav` | `backdrop-filter: blur(20px)` | ❌ Eliminado — bg `#050508` sólido |
| `.card-badge` | `backdrop-filter: blur(8px)` | ❌ Eliminado — bg sólido |
| `.card-reward` | `backdrop-filter: blur(8px)` | ❌ Eliminado — bg sólido |
| `.owned-badge` | `backdrop-filter: blur(6px)` | ❌ Eliminado — bg `rgba(34,208,122,0.2)` |

**El 10% Glass permitido (excepciones):**

| Elemento | Blur permitido | Justificación |
|---|---|---|
| `.toast` | `blur(12px)` | Legibilidad sobre cualquier fondo |
| `.modal-overlay` | `blur(4px)` | Modal crítico, blur reducido de 8px → 4px |
| `.identity-modal-overlay` | `blur(4px) brightness(0.4)` | Primera pantalla, reducido de 12px → 4px |
| `.coin-badge` | Sin blur, `rgba` translúcida | Efecto cristal sobre metal sólido en navbar |

---

#### C. Avatar Power Ring — Conic-Gradient Animado

El anillo del HUD se reconstruye con `conic-gradient` para crear un núcleo de energía visual. Se implementa aceleración en hover.

```css
/* ANTES — gradient en border-box con mask trick */
background: linear-gradient(135deg, var(--accent), transparent) border-box;
animation: ringRotate 4s linear infinite;

/* AHORA — conic-gradient con mask radial (Power Ring) */
background: conic-gradient(
    from 0deg,
    var(--accent) 0%, var(--accent-dim) 30%, transparent 50%,
    transparent 70%, var(--accent-dim) 85%, var(--accent) 100%
);
-webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #fff calc(100% - 3px));
animation: powerRingRotate 3s linear infinite;
will-change: transform;  /* GPU compositor layer */
```

En hover o focus-within, la animación se acelera de 3s → 1s y aumenta la opacidad + `filter: drop-shadow`.

---

#### D. Banner de Oferta — Efecto Laser Scan

Se elimina el shimmer estático `ticketSweep` y se implementa un **escaneo láser**: una línea oblicua de luz que recorre el banner de izquierda a derecha cada 3.5 segundos. El banner tiene ahora una textura de puntos como fondo.

```css
/* ANTES — sweep horizontal de 60% de ancho, movimiento lineal */
@keyframes ticketSweep { to { left: 200%; } }

/* AHORA — línea fina oblicua (105°), GPU-only con translate3d */
.sale-banner__ticket::after {
    width: 15%;   /* línea estrecha, aspecto de láser */
    background: linear-gradient(105deg, transparent, rgba(251,191,36,0.35), transparent);
    animation: laserScan 3.5s ease-in-out infinite;
    will-change: transform;
}
@keyframes laserScan {
    0%   { transform: translate3d(0, 0, 0);    opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { transform: translate3d(800%, 0, 0); opacity: 0; }
}
```

La textura de fondo del ticket cambia del patrón diagonal a **puntos radiales** para un aspecto más "ticket electrónico":

```css
.sale-banner__ticket::before {
    background-image: radial-gradient(circle, rgba(251,191,36,0.08) 1px, transparent 1px);
    background-size: 14px 14px;
}
```

---

#### E. Game Cards y Shop Cards — Hover por Glow de Borde

Las tarjetas de juego y tienda abandonan el fondo variable en hover. En su lugar, el borde se ilumina intensamente con el color de acento.

```css
/* ANTES — hover aclara el fondo (overdraw) */
.shop-card:hover { background: var(--glass-float-bg); }

/* AHORA — hover ilumina el borde (solo compositor GPU) */
.shop-card:hover {
    border-color: var(--accent-border);
    box-shadow: 0 0 15px var(--accent-glow), 0 8px 24px rgba(0,0,0,0.4);
}
.game-card:hover {
    box-shadow: 0 16px 40px rgba(0,0,0,0.6), 0 0 15px var(--accent-glow);
    border-color: var(--accent-border);
}
```

---

#### F. Player HUD — Detalles Tech de Esquina

El HUD reemplaza el ambient glow (gradiente radial costoso) por líneas de acento en la esquina superior izquierda usando `::before` y `::after` — señales de panel ensamblado.

```css
/* Línea horizontal de acento */
.player-hud::before { width: 48px; height: 2px; background: linear-gradient(90deg, var(--accent), transparent); }
/* Línea vertical de acento */
.player-hud::after  { width: 2px; height: 48px; background: linear-gradient(180deg, var(--accent), transparent); }
```

El mismo patrón de corner accent se aplica a `.glass-panel` (paneles del ajustes, sync, etc.).

---

#### G. Navbar y Bottom Nav — Superficies Tácticas

| Elemento | Color | Box-Shadow |
|---|---|---|
| `.navbar` | `#0d0e15` | `0 4px 24px rgba(0,0,0,0.6)` |
| `.bottom-nav` | `#050508` | `0 -4px 20px rgba(0,0,0,0.7)` |

Ambos mantienen el borde de 1px con `--border-subtle`. Los pseudo-elementos `::before` de degradado de acento se conservan para el indicador de sección activa.

---

### Resumen de archivos modificados

| Archivo | Cambio |
|---|---|
| `styles.css` | Rediseño completo — v2.0 → v3.0 "Arcade Solid". 15+ instancias de `backdrop-filter` eliminadas. Nuevos tokens `--solid-surface-*` y `--border-*`. Power Ring, Laser Scan, border-glow hover. |
| `DOCUMENTACION.md` | Sección 2h añadida. Título actualizado a v10.0. |

---



```
┌─────────────────────────────────────────────────────────────────────┐
│                              NAVEGADOR                               │
│                                                                      │
│   index.html  (SPA única)                                            │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  <nav class="navbar">        ← Global, siempre visible      │   │
│   │  <nav class="bottom-nav">    ← Global, siempre visible      │   │
│   │                                                             │   │
│   │  <main class="container">                                   │   │
│   │    <div id="view-home" class="view-section">   ← HUD, juegos, FAQ  │   │
│   │    <div id="view-shop" class="view-section hidden">  ← Tienda    │   │
│   │  </main>                                                    │   │
│   │                                                             │   │
│   │  <!-- Modales — fuera de main, position:fixed seguro -->    │   │
│   │  <div id="preview-modal">                                   │   │
│   │  <div id="confirm-modal">                                   │   │
│   │  <div id="email-modal">                                     │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   JS Load Order:                                                     │
│   1. js/app.js          → GameCenter API, store, updateUI            │
│   2. js/shop-logic.js   → Catálogo, compras, sync, ajustes          │
│   3. js/spa-router.js   → Navegación SPA sin recargas                │
│   4. Inline script      → HomeView lógica (countdown, racha)         │
│                                                                      │
│   Persistencia:   localStorage "gamecenter_v6_promos"                │
│   Web Worker:     js/sync-worker.js  (SHA-256 + Base64)              │
│   Catálogo:       data/shop.json  (cargado una sola vez)             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2i. Novedades en v10.1 — Limpieza Visual & Transiciones Anti-Golpe

### Resumen

| Área | Cambio |
|---|---|
| **CSS — Corner accents** | Eliminados los pseudo-elementos de "corchete" en `.glass-panel` y `.player-hud`. |
| **CSS — `.view-section`** | Nueva clase con transición GPU de entrada (opacity + translateY, 250ms). |
| **spa-router.js** | Scroll reset reordenado: ahora ocurre **antes** de quitar `.hidden` en la vista entrante. |

---

### 1. Eliminación de Corner Accents

Los pseudo-elementos `::before` / `::after` añadidos en v10.0 sobre `.glass-panel` y `.player-hud` generaban líneas de acento en la esquina superior izquierda. En pantallas móviles a alta densidad de píxeles estas líneas de 2px se percibían como artefactos o errores de renderizado, rompiendo la limpieza de los paneles sólidos.

**Acción:** eliminados completamente de `.glass-panel::after`, `.player-hud::before` y `.player-hud::after`. La jerarquía visual se mantiene únicamente a través del color de fondo sólido y el borde de 1px.

```css
/* ELIMINADO — ya no existe en styles.css */
.glass-panel::after  { content: ''; width: 24px; height: 2px; ... }
.player-hud::before  { content: ''; width: 48px; height: 2px; ... }
.player-hud::after   { content: ''; width: 2px;  height: 48px; ... }
```

---

### 2. Sistema de Transiciones de Vista — `.view-section`

#### Problema

Al alternar entre Inicio y Tienda, el contenido aparecía instantáneamente (un "golpe" visual), haciendo que la app se sintiera como una página web recargando en lugar de una interfaz reactiva.

#### Solución

Nueva clase `.view-section` en `styles.css`. Debe aplicarse en el HTML a los contenedores `#view-home` y `#view-shop`:

```html
<div id="view-home"  class="view-section">...</div>
<div id="view-shop"  class="view-section hidden">...</div>
```

```css
.view-section {
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.25s ease-out, transform 0.25s ease-out;
    will-change: opacity, transform;
    contain: paint;
}
.view-section:not(.hidden) {
    opacity: 1;
    transform: translateY(0);
}
```

#### Decisiones técnicas

| Decisión | Justificación |
|---|---|
| `opacity` + `transform` únicamente | Propiedades compositor-only. Cero layout, cero paint. |
| `translateY(10px)` → `translateY(0)` | Solo 10px: entrada suave sin parecer slide agresivo. |
| `ease-out` | Respuesta perceptualmente inmediata; la animación desacelera al llegar. |
| `0.25s` (250ms) | Regla de los 300ms: por encima el usuario percibe lentitud. |
| `will-change: opacity, transform` | Promueve el nodo a capa GPU antes del primer frame. |
| `contain: paint` | Limita repaints al área del nodo; el documento padre no se ve afectado. |

#### Reglas de oro — GPU-First

```css
/* ❌ PROHIBIDO — provoca reflow */
transition: height 0.3s;
transition: margin 0.3s;
transition: width 0.3s;

/* ✅ PERMITIDO — solo compositor GPU */
transition: opacity 0.25s ease-out, transform 0.25s ease-out;
```

---

### 3. Reordenación del Scroll Reset en spa-router.js

#### Problema

El scroll reset se ejecutaba **después** de quitar `.hidden`. La vista nueva aparecía durante un frame con su scroll anterior antes de saltar al inicio, compitiendo visualmente con la animación de entrada.

#### Solución (v9.2)

`_applyView()` ejecuta el scroll reset **antes** de modificar `.hidden`:

```javascript
function _applyView(viewId, anchor) {
    // 1. Scroll reset instantáneo ANTES de mostrar la vista
    if (!anchor) window.scrollTo({ top: 0, behavior: 'instant' });

    // 2. Toggle .hidden → dispara la transición CSS de entrada
    VIEWS.forEach(id => viewEls[id].classList.toggle('hidden', id !== viewId));

    // 3. Sincronizar saldo, iconos, callbacks...
}
```

Cuando la transición `opacity 0→1` empieza, el scroll ya está en `top: 0`.

---

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `styles.css` | v3.0 → v3.1. Corner accents eliminados. `.view-section` añadido. |
| `spa-router.js` | v9.1 → v9.2. Scroll reset reordenado. JSDoc actualizado. |
| `DOCUMENTACION.md` | Sección 2i añadida. |

> **Estado actual:** la clase `view-section` está aplicada en `#view-home` y `#view-shop` de `index.html` (corregido en v9.6). Las transiciones de entrada se disparan correctamente.

---

## 2j. Novedades en v10.2 — Preview 2.0 Sistema de Mockup Dinámico

> **v10.2.3 — Performance & Security hardening:**
> Carga progresiva con doble capa, flush de memoria GPU, will-change dinámico,
> bloqueo anti-extracción reforzado, y restricción 90/10 backdrop-filter en mobile.

### Resumen

| Área | Cambio |
|---|---|
| **shop-logic.js** | `openPreviewModal()` reemplazado con sistema de mockup dinámico. Nuevas funciones: `_buildMockupHTML()`, `updateMockupTime()`, `closePreviewModal()`. Expuestas en `window`. |
| **index.html** | `#preview-img-wrap` sustituido por `#preview-mockup-stage` + `#mockup-slot`. El `<img>` fue eliminado; el arte vive ahora como CSS `background-image`. |
| **styles.css** | +130 líneas. Nuevas clases: `.mockup-container`, `.mockup-mobile`, `.mockup-pc`, `.mockup-layer-*`, `.mockup-statusbar`, `.mockup-app-grid`, `.mockup-taskbar` y variantes. |

---

### 1. Arquitectura del Mockup ("Sándwich de Capas")

Dentro de `#mockup-slot`, JS inyecta un `div.mockup-container` con tres capas superpuestas via `position: absolute; inset: 0`:

```
┌─────────────────────────────────────┐  ← mockup-container (border-radius, overflow:hidden)
│  Layer 3 — UI          z-index: 3   │  Status bar / taskbar / reloj / grid de iconos
│  Layer 2 — Protección  z-index: 2   │  pointer-events:none · noise SVG overlay
│  Layer 1 — Arte        z-index: 1   │  background-image (CSS, no <img>)
└─────────────────────────────────────┘
```

**¿Por qué `background-image` y no `<img>`?**
El menú contextual del navegador "Guardar imagen como…" solo aparece sobre elementos `<img>` y `<video>`. Al usar `background-image` en un div, ese menú no ofrece la opción de guardar — primera línea de defensa anti-piratería.

---

### 2. Detección de Frame (Tags → Ratio)

La función `_buildMockupHTML(item)` lee `item.tags[]` del catálogo:

| Tag en `shop.json` | Clase aplicada | Ratio | Descripción |
|---|---|---|---|
| `"Mobile"` | `.mockup-mobile` | 9:20 | Frame teléfono, max-height 58vh, border-radius 24px |
| `"PC"` | `.mockup-pc` | 16:9 | Frame escritorio, ancho 100% |
| (ninguno) | `.mockup-fallback` | 4:3 | Neutral con watermark del logo |

---

### 3. UI Elements — Mobile

El frame Mobile incluye tres componentes UI sobre el wallpaper:

**Status Bar**
- Izquierda: reloj en tiempo real (`.mockup-clock-text`)
- Derecha: iconos SVG inline de señal, Wi-Fi y batería
- `mix-blend-mode: difference` adapta el color del texto al brillo del fondo

**App Grid**
- Cuadrícula 4×4 de 16 placeholders (`.mockup-app-icon`)
- Por defecto: `rgba(12,12,24,0.82)` sólido — sin coste GPU en gama baja
- Con soporte `backdrop-filter`: glassmorphism blur(4px) activado vía `@supports`

**Home Indicator**
- Barra de 28% del ancho centrada en el borde inferior
- `mix-blend-mode: difference` para contraste automático

---

### 4. UI Elements — PC

El frame PC incluye una **barra de tareas** en el borde inferior:

- Izquierda: botón de inicio + 5 app slots genéricos
- Derecha: iconos Wi-Fi + batería + reloj (`.mockup-pc-clock`)
- Fondo: `rgba(8,8,18,0.78)` sólido o glassmorphism con `@supports`

---

### 5. Reloj en Tiempo Real

```javascript
// shop-logic.js
let _mockupClockInterval = null;

function updateMockupTime() {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.querySelectorAll('.mockup-clock-text, .mockup-pc-clock')
        .forEach(el => el.textContent = t);
}

// En openPreviewModal():
updateMockupTime();                              // Inmediato al abrir
_mockupClockInterval = setInterval(updateMockupTime, 30_000); // Cada 30 s
```

El intervalo se destruye explícitamente en `closePreviewModal()` para evitar memory leaks.

---

### 6. Anti-Piratería (Hardening)

| Técnica | Implementación |
|---|---|
| Bloqueo "Guardar imagen" | Arte como `background-image` en div, no `<img>` |
| Bloqueo menú contextual | `contextmenu` → `preventDefault()` en `#preview-mockup-stage` |
| Overlay de cobertura | `.mockup-layer-ui` cubre el 100% del arte con SVG de interfaz |
| Noise overlay | `.mockup-layer-protection` con ruido SVG data-URI (sin HTTP) |
| `user-select: none` | En todas las capas de UI y protección |

---

### 7. Optimización para Gama Baja

| Técnica | Implementación |
|---|---|
| GPU rendering | `transform: translateZ(0)` en `.mockup-container` |
| Containment | `contain: paint` en `.mockup-container` |
| Container queries | `container-type: inline-size` en `#mockup-slot` para escalar iconos de forma fluida |
| SVG inline | Todos los iconos del mockup son SVG inline; cero peticiones HTTP extra |
| Glassmorphism condicional | Default = sólido. `@supports (backdrop-filter)` opt-in solo si el hardware lo soporta |

**Regla de gama baja para el app grid:**
```css
/* ✅ CORRECTO — sólido por defecto, glassmorphism como opt-in */
.mockup-app-icon {
    background: rgba(12, 12, 24, 0.82); /* sin coste GPU */
}
@supports (backdrop-filter: blur(4px)) {
    .mockup-app-icon { backdrop-filter: blur(4px); } /* solo en hardware capaz */
}

/* ❌ INCORRECTO — backdrop-filter como valor por defecto degrada gama baja */
.mockup-app-icon { backdrop-filter: blur(4px); }
```

---

### 8. API Pública — Funciones en `window`

A partir de v10.2.1, las funciones del preview están expuestas globalmente:

```javascript
window.openPreviewModal(itemOrId)  // Acepta objeto item O número de ID
window.closePreviewModal()         // Sin parámetros — resuelve refs internamente
```

Esto permite llamarlas desde:
- Event listeners en HTML dinámico: `onclick="openPreviewModal(5)"`
- Módulos de juego integrados
- La consola del navegador durante desarrollo

```javascript
// ✅ Ambas formas son válidas:
openPreviewModal(item);           // objeto completo (renderShop)
openPreviewModal(5);              // ID numérico (onclick dinámico)
openPreviewModal('5');            // ID como string (atributo HTML)
```

---

### 9. Nuevas Funciones en `shop-logic.js`

| Función | Visibilidad | Responsabilidad |
|---|---|---|
| `_buildMockupHTML(item)` | Privada | Genera el HTML del mockup según los tags del item. Retorna string. |
| `updateMockupTime()` | Privada | Actualiza el reloj en todos los elementos de clock activos. |
| `closePreviewModal([modal], [stage])` | **Pública (`window`)** | Cierra el modal, cancela el intervalo, elimina listener contextmenu. Sin args = auto-resolve. |
| `openPreviewModal(itemOrId)` | **Pública (`window`)** | Acepta objeto O ID. Null-guard. Orquesta mockup, reloj y acciones. |
| `MOCKUP_SVG` | Privada (constante) | Paths SVG inline: signal, wifi, battery, arcadeLogo. |

---

### Correcciones y mejoras v10.2.3

#### A. Carga Progresiva — Doble Capa "Thumbnail de Sacrificio"

Elimina el "pop-in" blanco en conexiones lentas. El sistema usa dos fases sin bloquear el hilo principal:

```
Fase 1 (inmediata, 0ms):   thumbnail en caché → blurred placeholder
Fase 2 (async, cuando carga): wallpaper HiRes → swap con 400ms ease
```

```javascript
// Fase 1 — placeholder visible al instante
artEl.style.backgroundImage = `url('${item.image}')`;  // thumb ya en caché
artEl.classList.add('mockup-bg-loading');               // blur(10px) + scale(1.1)

// Fase 2 — HiRes en background
const hiRes = new Image();
hiRes.onload = () => {
    artEl.style.backgroundImage = `url('${wallpaperPath}')`;
    artEl.classList.remove('mockup-bg-loading');
    artEl.classList.add('mockup-bg-ready');             // blur(0) + scale(1)
};
hiRes.src = wallpaperPath;
```

**Stale-load guard:** `_pendingHiResImg` almacena la referencia del `Image()` activo. Si el usuario cierra y reabre el modal antes de que cargue, el `onload` del objeto anterior comprueba `_pendingHiResImg !== hiRes` y se descarta sin ejecutar.

| CSS class | filter | transform | Cuándo |
|---|---|---|---|
| `.mockup-bg-loading` | `blur(10px)` | `scale(1.1)` | Thumbnail mostrado |
| `.mockup-bg-ready` | `blur(0)` | `scale(1)` | HiRes listo |
| (sin clase) | — | — | Estado inicial / tras close |

---

#### B. Gestión de Memoria GPU (Memory Flush)

`closePreviewModal()` realiza limpieza activa en este orden:

1. **Cancela el `Image()` en vuelo** — anula `onload`/`onerror`, evita callbacks huérfanos
2. **Flush GPU** — `artEl.style.backgroundImage = 'none'` libera el buffer de textura
3. **Limpia clases de estado** — `classList.remove('mockup-bg-loading', 'mockup-bg-ready')`
4. **Elimina `will-change`** — `modal.style.willChange = 'auto'` descarta la capa GPU del compositor
5. **Oculta el modal** — `classList.add('hidden')`
6. **Elimina contextmenu listeners** — stage + slot

```javascript
// Patrón correcto en closePreviewModal():
artEl.style.backgroundImage = 'none';   // ← libera textura GPU inmediatamente
modal.style.willChange = 'auto';        // ← descarta capa compositor
```

---

#### C. `will-change` Dinámico (Solo Durante Uso)

`will-change` en CSS global desperdicia memoria GPU en capas que nunca se animan. El sistema lo gestiona únicamente durante la vida del modal:

```javascript
// openPreviewModal():
modal.style.willChange = 'opacity, transform';  // Promueve capa al abrir

// closePreviewModal():
modal.style.willChange = 'auto';                // La descarta al cerrar
```

`.mockup-container` usa `translate3d(0,0,0)` (sin `will-change`) para forzar la creación de capa GPU sólo en ese elemento, sin el coste de memoria de `will-change`.

---

#### D. Anti-Extracción Reforzado

| Capa | Mecanismo |
|---|---|
| CSS `background-image` | El arte nunca es un `<img>` — no hay "Guardar imagen como…" |
| `.mockup-layer-protection` | Overlay con ruido SVG `feTurbulence`, `pointer-events: none` |
| `.mockup-layer-art::after` | Segunda capa de ruido a 3% opacidad directamente sobre el arte |
| `stage.addEventListener('contextmenu')` | Bloquea el menú en toda la zona del mockup |
| `slot.oncontextmenu = (e) => { e.preventDefault(); return false; }` | Bloqueo adicional directo sobre el slot |

---

#### E. Regla 90/10 — `backdrop-filter` Restringido en Mobile

`backdrop-filter: blur()` consume GPU de forma intensiva. En hardware móvil (touch) causa caídas de fps:

```css
/* Detección: pointer: coarse = dispositivo táctil (móvil/tablet) */
@media (pointer: coarse) {
    .mockup-app-icon { backdrop-filter: none !important; }
    .mockup-taskbar  { backdrop-filter: none !important;
                       background: rgba(8,8,18,0.92) !important; }
}
```

`pointer: coarse` es más fiable que `max-width` para detectar hardware táctil — un iPad en horizontal tiene 1024px pero sigue siendo gama media. La mayor opacidad del taskbar compensa visualmente la ausencia de blur.

---

### Archivos modificados

| Archivo | Versión | Cambio |
|---|---|---|
| `shop-logic.js` | v9.1 → v10.2.3 | Carga progresiva, memory flush, will-change dinámico, contextmenu reforzado. |
| `index.html` | — | Preview modal con `#preview-mockup-stage` + `#mockup-slot`. |
| `styles.css` | v3.1 → v3.2.3 | `.mockup-bg-loading/ready`, `::after` noise en art layer, `backface-visibility` en overlay, `@media (pointer: coarse)`. |
| `DOCUMENTACION.md` | — | Sección 2j v10.2.3. |

Dentro de `#mockup-slot`, JS inyecta un `div.mockup-container` con tres capas superpuestas via `position: absolute; inset: 0`:

```
┌─────────────────────────────────────┐  ← mockup-container (border-radius, overflow:hidden)
│  Layer 3 — UI          z-index: 3   │  Status bar / taskbar / reloj / grid de iconos
│  Layer 2 — Protección  z-index: 2   │  pointer-events:none · noise SVG overlay
│  Layer 1 — Arte        z-index: 1   │  background-image (CSS, no <img>)
└─────────────────────────────────────┘
```

**¿Por qué `background-image` y no `<img>`?**
El menú contextual del navegador "Guardar imagen como…" solo aparece sobre elementos `<img>` y `<video>`. Al usar `background-image` en un div, ese menú no ofrece la opción de guardar — primera línea de defensa anti-piratería.

---

### 2. Detección de Frame (Tags → Ratio)

La función `_buildMockupHTML(item)` lee `item.tags[]` del catálogo:

| Tag en `shop.json` | Clase aplicada | Ratio | Descripción |
|---|---|---|---|
| `"Mobile"` | `.mockup-mobile` | 9:20 | Frame teléfono, max-height 58vh, border-radius 24px |
| `"PC"` | `.mockup-pc` | 16:9 | Frame escritorio, ancho 100% |
| (ninguno) | `.mockup-fallback` | 4:3 | Neutral con watermark del logo |

---

### 3. UI Elements — Mobile

El frame Mobile incluye tres componentes UI sobre el wallpaper:

**Status Bar**
- Izquierda: reloj en tiempo real (`.mockup-clock-text`)
- Derecha: iconos SVG inline de señal, Wi-Fi y batería
- `mix-blend-mode: difference` adapta el color del texto al brillo del fondo

**App Grid**
- Cuadrícula 4×4 de 16 placeholders (`.mockup-app-icon`)
- 90% sólido (`rgba(12,12,24,0.82)`) con borde sutil
- Con soporte `backdrop-filter`: glassmorphism blur(4px) activado vía `@supports`

**Home Indicator**
- Barra de 28% del ancho centrada en el borde inferior
- `mix-blend-mode: difference` para contraste automático

---

### 4. UI Elements — PC

El frame PC incluye una **barra de tareas** en el borde inferior:

- Izquierda: botón de inicio + 5 app slots genéricos
- Derecha: iconos Wi-Fi + batería + reloj (`.mockup-pc-clock`)
- Fondo: `rgba(8,8,18,0.78)` sólido o glassmorphism con `@supports`

---

### 5. Reloj en Tiempo Real

```javascript
// shop-logic.js
let _mockupClockInterval = null;

function updateMockupTime() {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.querySelectorAll('.mockup-clock-text, .mockup-pc-clock')
        .forEach(el => el.textContent = t);
}

// En openPreviewModal():
updateMockupTime();                              // Inmediato al abrir
_mockupClockInterval = setInterval(updateMockupTime, 30_000); // Cada 30 s
```

El intervalo se destruye explícitamente en `closePreviewModal()` para evitar memory leaks.

---

## 4. Estructura de Archivos

```
love_arcade/
│
├── index.html              # SPA unificada (Inicio + Tienda en un solo archivo)
│                           # shop.html ELIMINADO en v9.0
├── styles.css              # Hoja de estilos global — Arcade Solid 3.1 (v10.1)
│
├── js/
│   ├── app.js              # Motor principal — GameCenter API v9.0
│   │                       #   + getState(), syncUI() (nuevos en v9.0)
│   ├── shop-logic.js       # Módulo de Tienda — extraído de shop.html (nuevo en v9.0)
│   ├── streak-hub.js       # Daily Streak Hub — API visual y secuencia de reclamo
│   ├── spa-router.js       # Router SPA — v9.2, scroll-before-transition (v10.1)
│   └── sync-worker.js      # Web Worker — Base64 + checksum SHA-256 (sin cambios)
│
├── data/
│   └── shop.json           # Catálogo de wallpapers (sin cambios)
│
├── wallpapers/             # Carpeta local legacy (reemplazada por Cloudinary CDN)
├── assets/
│   └── default_avatar.avif
│
│   # assets/product-thumbs/ → ELIMINADA en v9.5 (Cloudinary CDN Migration)
│   # assets/cover/          → ELIMINADA en v9.5 (Cloudinary CDN Migration)
│
└── games/
    ├── Shooter/
    ├── SopaDeLetras/
    ├── pixel_drop.html
    ├── maze.html
    ├── rompecabezas/
    ├── Dodger/
    └── jungle-dash/
```

---

## 5. app.js — El Motor

### Cambios en v9.1 (Theme Fix)

#### `applyTheme()` — refactorizado

El problema: `applyTheme` solo aplicaba CSS custom properties en `:root` y el atributo `data-theme` en `<html>`, pero no escribía ninguna clase en `<body>`. Si el CSS usaba selectores del tipo `body.theme-crimson .selector {}`, el cambio no era visible.

**Solución:** `applyTheme` ahora hace tres cosas en orden:

```javascript
function applyTheme(key) {
    // 1. Actualizar CSS custom properties (retrocompatibilidad con juegos)
    root.style.setProperty('--accent', t.accent);
    // ...

    // 2. Limpiar clases de tema previas y añadir la nueva en <body>
    Object.keys(THEMES).forEach(k => document.body.classList.remove(`theme-${k}`));
    document.body.classList.add(`theme-${key}`);

    // 3. data-theme en <html> (retrocompatibilidad)
    document.documentElement.setAttribute('data-theme', key);

    // 4. Sincronizar estado visual de los botones
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('theme-btn--active', btn.dataset.theme === key);
    });
}
```

El `<body>` arranca con `class="theme-violet"` en el HTML para evitar un flash sin tema antes de que `app.js` ejecute el primer `applyTheme`.

#### Listener `.theme-btn` — deduplicado

En v9.0, el listener de clic en `.theme-btn` estaba registrado dos veces: en `app.js` DOMContentLoaded y en `shop-logic.js` DOMContentLoaded. Esto causaba que `setTheme()` se llamara dos veces por clic.

**Solución v9.1:** el registro en `app.js` DOMContentLoaded fue eliminado. El único listener vive en `shop-logic.js`. `setTheme()` sigue siendo la fuente de verdad para el store y la lógica visual.

### Cambios en v9.0 (SPA Migration)

Dos métodos nuevos añadidos al objeto `window.GameCenter`:

#### `getState()` — lectura segura del store

```javascript
GameCenter.getState()
// Returns: { coins, streak, theme, moonBlessingExpiry }
```

Devuelve una copia plana de los campos públicos del store. **No expone la referencia al objeto `store` interno**, evitando que módulos externos puedan mutar el estado sin pasar por la API.

Usado por `shop-logic.js` en `renderStreakCalendar()` y potencialmente por cualquier módulo externo que necesite leer el estado sin depender de múltiples llamadas individuales.

#### `syncUI()` — sincronización forzada del saldo

```javascript
GameCenter.syncUI()
// Returns: void
```

Resetea `_displayedCoins` al valor real del store y ejecuta `updateUI()`. Garantiza que, al navegar entre vistas, todos los `.coin-display` (Navbar + HUD) muestren el saldo correcto de forma inmediata y animada.

Llamado por `spa-router.js` en cada transición de vista.

```javascript
// Ejemplo de uso interno en spa-router.js
function navigateTo(viewId) {
    // ... toggle views ...
    window.GameCenter?.syncUI?.();
}
```

### Cambios en v8.0

Sin cambios en la lógica de negocio. Las únicas modificaciones en v8.0 son:

**Emojis eliminados de strings internos:**

| Antes (v7.5) | Después (v8.0) |
|---|---|
| `'🌙 Bendición Lunar activada (7 días)'` | `'Bendición Lunar activada (7 días)'` |
| `Racha: ${n} 🔥` | `Racha: ${n}` |
| `' + 🌙 Bendición Lunar'` | `' + Bendición Lunar'` |
| `'+🌙'` en moonNote | `'+Luna'` |
| `'Activar Bendición Lunar (100 🪙)'` | `'Activar Bendición Lunar (100 monedas)'` |
| Badge title: `'🌙 Bendición Lunar activa hasta…'` | `'Bendición Lunar activa hasta…'` |

La representación visual de la luna es ahora responsabilidad exclusiva del icono SVG Sprite `<svg class="icon"><use href="#icon-moon"></use></svg>` en el HTML.

La función `updateMoonBlessingUI()` actualiza el `<span class="moon-blessing-badge">` (que ya contiene el icono SVG) mostrándolo u ocultándolo con la clase `hidden`. Ya no modifica el `textContent` del badge porque ese contenido es el icono SVG.

### Cambios en v8.1 (Daily Claim Security)

#### Sistema de tiempo — rediseño en v9.6 (Background Sync)

La verificación de tiempo fue **completamente desacoplada del momento del reclamo**. En lugar de hacer una petición de red cuando el usuario pulsa el botón, el sistema mantiene un caché local que se actualiza silenciosamente en segundo plano.

##### `_syncTimeBackground()` — sincronización en background

```javascript
async function _syncTimeBackground()  // sin valor de retorno
```

Consulta ambas APIs **en paralelo** (`Promise.any`) y escribe el resultado en `localStorage` (`love_arcade_time_cache`). Se lanza automáticamente en tres momentos:

| Trigger | Cuándo ocurre |
|---|---|
| `DOMContentLoaded` + 800 ms | Al cargar la página, sin competir con el primer paint |
| `visibilitychange → visible` | Cuando el usuario vuelve a la pestaña |
| `setInterval` 30 min | Refresco periódico si la app permanece abierta |

El resultado nunca interrumpe la UI — si todas las fuentes fallan, el caché existente se conserva.

##### `_readTimeCache()` — lectura síncrona del caché

```javascript
function _readTimeCache()
// Returns: { time: number, verified: boolean, desynced: boolean, cacheAge: number }
```

Lectura puramente local, sin red. Usada por `claimDaily()`.

| Campo | Descripción |
|---|---|
| `time` | Estimación del timestamp de red: `Date.now() + drift` |
| `verified` | `true` si el caché existe y tiene menos de `TIME_CACHE_TTL` (4 h) |
| `desynced` | `true` si el último sync detectó que el reloj local estaba adelantado > 5 min |
| `cacheAge` | Antigüedad del caché en ms |

Constantes asociadas:
- `CLOCK_SKEW_LIMIT = 5 * 60 * 1000` ms
- `TIME_API_TIMEOUT = 4000` ms (por petición individual)
- `TIME_CACHE_TTL = 4 * 60 * 60 * 1000` ms (4 horas)

#### `claimDaily()` — síncrono desde v9.6

Ya **no es `async`** ni hace ninguna petición de red. Lee `_readTimeCache()` y devuelve el resultado de forma instantánea.

```javascript
// Signature (v9.6)
claimDaily(): {
    success: boolean,
    reward?: number,
    baseReward?: number,
    moonBonus?: number,
    streak?: number,
    verified: boolean,
    message: string
}
```

Capas de validación (en orden):

1. **Salto negativo** (`now < lastClaim`): bloquea sin tocar la racha.
2. **Reloj adelantado** (`desynced === true` del caché): bloquea con advertencia.
3. **Día calendario** (diff via `setHours(0,0,0,0)`).
4. **Bendición Lunar**: se concede siempre que el buff esté activo — la protección contra abuso queda cubierta por el `desynced` del sync anterior.

#### `canClaimDaily()` — lógica de día calendario

```javascript
// Antes (v8.0):
canClaimDaily: () => Date.now() - store.daily.lastClaim >= 86_400_000

// Ahora (v8.1):
canClaimDaily: () => {
    const nowMidnight  = new Date().setHours(0, 0, 0, 0);
    const lastMidnight = new Date(lastClaim).setHours(0, 0, 0, 0);
    return (nowMidnight - lastMidnight) >= 86_400_000;
}
```

#### `getStreakInfo()` — lógica de día calendario

Usa la misma normalización a medianoche para calcular `diffDays` y determinar si la racha continúa o se reinicia.

#### Event listener de `#btn-daily`

```javascript
// Antes (v8.0): handler síncrono
dailyBtn.addEventListener('click', () => {
    const result = window.GameCenter.claimDaily();
    // ...
});

// Ahora (v8.1): handler async con bloqueo inmediato
dailyBtn.addEventListener('click', async () => {
    // SÍNCRONO — antes de cualquier await:
    dailyBtn.disabled      = true;
    dailyBtn.style.opacity = '0.5';
    // Cambiar texto a "Procesando..."
    // ...
    const result = await window.GameCenter.claimDaily();
    // Restaurar estado por updateDailyButton()
});
```

---

## 6. sync-worker.js — Web Worker

**Actualizado en v9.6** — modernización de encoding; sin cambios en el protocolo de mensajes.

El worker maneja el checksum SHA-256 para las operaciones de exportación e importación de partidas, garantizando integridad antes de aplicar cualquier dato al store. El flujo completo es:

```
Usuario carga archivo .txt  →  FileReader lee el texto  →
textarea recibe el contenido  →  handleImport() llama a
GameCenter.importSave(code)  →  workerTask({action:'import', code, salt})
→  sync-worker.js verifica el checksum SHA-256  →
¿válido? → store = migrateState(data) → saveState()
¿inválido? → rechazado con mensaje de error
```

Los mensajes soportados:

| `action`   | Payload requerido       | Resultado devuelto                        |
|---|---|---|
| `'export'` | `{ store, salt }`       | `string` — código Base64 con checksum     |
| `'import'` | `{ code, salt }`        | `{ data, valid, legacy }` — store + validez |

### Cambios v9.6 — Modernización de encoding

Las funciones `escape()` y `unescape()` estaban marcadas como **deprecadas** desde ES5 y han sido eliminadas de la especificación en ES2025. Se han reemplazado en ambas operaciones:

| Operación | Antes (deprecado) | Después (moderno) |
|---|---|---|
| `exportStore` | `btoa(unescape(encodeURIComponent(payload)))` | `TextEncoder` → `Array.from` → `String.fromCharCode` → `btoa` |
| `importStore` | `decodeURIComponent(escape(atob(code)))` | `atob` → `Uint8Array` → `TextDecoder` |

El resultado codificado/decodificado es **byte-por-byte idéntico** al patrón anterior para contenido ASCII; la diferencia es relevante para payloads que contengan caracteres fuera del rango ASCII (nicknames con tildes, emojis en `saleLabel`, etc.), donde el patrón antiguo podía producir cadenas corruptas en motores estrictos.

> **Compatibilidad de códigos existentes:** Los códigos exportados con versiones anteriores del worker siguen siendo válidos. `importStore` incluye un bloque de compatibilidad legada (`legacy: true`) que maneja stores sin checksum (v7.2 y anteriores).

### Notas de versión

El archivo declaraba `v7.5` en su cabecera JSDoc desde su creación. Actualizado a `v9.6` para mantener coherencia con el resto del proyecto.

---

## 7. shop.json — El Catálogo

`data/shop.json` es el único catálogo publicado. Es un array de ítems con este contrato:

```json
{
  "id": 1,
  "name": "Nombre visible",
  "price": 110,
  "category": "art",
  "type": "image",
  "imageUrl": "https://res.cloudinary.com/<cloud>/image/upload/<public_id>"
}
```

- `id`: entero no negativo, único y estable; también es la clave de `store.inventory[id]`.
- `name`: texto visible no vacío.
- `price`: entero no negativo.
- `category`: `"art"` por ahora.
- `type`: `"image"` o `"file"`.
- `imageUrl`: URL Cloudinary original (`/image/upload/<public_id>`), sin un segmento de transformación.
- `downloadUrl`: obligatorio y no vacío solo para `type: "file"`.

No se publican `shop-gifts.json`, `tags`, `file`, `requirements` ni `category: "gift"`. Los IDs históricos retirados y sus colisiones documentadas se conservan en `data/retired-shop-gift-ids.json`; nunca se deben reasignar IDs que puedan existir en inventarios persistidos.

Para añadir un ítem, usa una URL Cloudinary fuente en `imageUrl`, no una miniatura transformada. Las transformaciones visuales y la descarga de imágenes se derivan en cliente, de modo que el dato fuente permanece estable.

## 8. index.html — SPA Unificada

A partir de v9.0, `index.html` es el **único archivo HTML** de la plataforma. Contiene las dos vistas de la aplicación, la navbar y bottom-nav globales, y todos los modales.

### Cambios en v9.1

#### `<body class="theme-violet">`

El `<body>` arranca con la clase del tema por defecto. Esto evita un FOUC (Flash Of Unstyled Content) en el selector de temas antes de que `app.js` ejecute `applyTheme()`. Si el usuario ya tenía guardado otro tema en localStorage, `applyTheme()` reemplaza la clase inmediatamente en el primer ciclo.

```html
<!-- v9.0 -->
<body>

<!-- v9.1 -->
<body class="theme-violet">
```

#### `#shop-error-state` — UI de error de red

Añadido dentro de `#shop-catalog`, inicialmente oculto. Se hace visible cuando `loadCatalog()` detecta un fallo de red:

```html
<div id="shop-error-state" class="shop-error-state hidden" role="alert">
    <svg class="icon" width="40" height="40"><use href="#icon-wifi-off"></use></svg>
    <p class="shop-error-title">No se pudo cargar el catálogo</p>
    <p class="shop-error-desc">Revisa tu conexión e inténtalo de nuevo.</p>
    <button id="btn-retry-shop" class="btn-primary">
        <svg class="icon" width="14" height="14"><use href="#icon-refresh-cw"></use></svg>
        Reintentar
    </button>
</div>
```

El botón `#btn-retry-shop` es enlazado por `loadCatalog()` en `shop-logic.js`.

### Jerarquía del DOM

```
<body>
  <nav class="navbar glass-panel">        ← Global (Navbar superior)
  <nav class="bottom-nav">                ← Global (Nav inferior móvil)

  <main class="container">
    <div id="view-home" class="view-section">  ← Vista Inicio
      .player-hud
      #games.games-grid
      #faq
    </div>

    <div id="view-shop" class="view-section hidden">  ← Vista Tienda (oculta al inicio)
      #btn-toggle-collection
      #shop-catalog                 ← ítems no poseídos
      #shop-collection              ← montaje lazy de ítems poseídos
    </div>

    <div id="view-profile" class="view-section hidden">  ← Vista Perfil
      [data-profile-panel="home"]
      [data-profile-panel="promotions"]
        #promo-input
        #btn-redeem
    </div>
  </main>

  <!-- MODALES — fuera de <main> ─────────────────────────── -->
  <div id="preview-modal" class="modal-overlay hidden">
  <div id="confirm-modal" class="modal-overlay hidden">
  <div id="email-modal"   class="modal-overlay hidden">

  <script src="js/app.js"></script>
  <script src="js/shop-logic.js"></script>
  <script src="js/spa-router.js"></script>
  <script>/* HomeView logic (countdown, racha) */</script>
</body>
```

### Por qué los modales están fuera de `<main>`

El bug de scroll gigante que afectaba a versiones anteriores era causado por modales con `position: fixed` anidados dentro de contenedores con `overflow: hidden` o `transform`. Al estar dentro de `<main>`, su contexto de apilamiento (stacking context) quedaba confinado al contenedor padre.

**Solución:** mover los tres modales al final de `<body>`, a nivel raíz. `position: fixed` ahora toma el viewport completo como referencia y los modales se superponen correctamente sin arrastrar el layout.

### Navegación con `data-view`

Los enlaces de la navbar y la bottom-nav usan `data-view` en lugar de `href` para que `spa-router.js` pueda interceptar el clic:

```html
<!-- Antes (multi-page) -->
<a href="shop.html" class="nav-link">Tienda</a>

<!-- Ahora (SPA) -->
<a href="#" class="nav-link" data-view="shop">Tienda</a>
```

Los deep-links a secciones internas del Inicio usan adicionalmente `data-anchor`:

```html
<a href="#" class="nav-link" data-view="home" data-anchor="games">Juegos</a>
```

El router detecta el anchor, navega al Inicio y hace scroll suave hasta el elemento `#games`.

### `window.HomeView`

Objeto expuesto por el script inline de `index.html`. Permite al router refrescar la vista de Inicio sin conocer los detalles de su implementación:

```javascript
window.HomeView = {
    refresh() {
        updateCountdownDisplay(); // Refresca el countdown del bono diario
        updateStreakBar();         // Actualiza la barra de racha
    },
    /**
     * Llamado por spa-router.js al SALIR de la vista Inicio (v9.6).
     * Hook de ciclo de vida preparado para futuros observers/timers.
     */
    onLeave() {
        // placeholder — listo para futuros recursos que requieran cleanup
    }
};
```

---

## 9. js/shop-logic.js — Módulo de Tienda

`shop-logic.js` carga y valida `data/shop.json`, controla las vistas Tienda/Colección, previews, compra, descargas, correo y la navegación interna de Perfil. Depende de `window.GameCenter`, `window.ECONOMY`, `window.MailHelper`, `window.ModalA11y` y `window.GhostAnalytics`.

### Carga y vistas

El catálogo se descarga una vez durante la inicialización y se valida antes de alcanzar el DOM. La Tienda filtra por `GameCenter.getBoughtCount(item.id) === 0`. La Colección se crea solo al abrirse por primera vez; entonces construye su índice normalizado de nombres y filtra en memoria por coincidencia parcial. No existe búsqueda global ni filtros por tags.

El grid es visual, usa dos railes deterministas y tarjetas `button` con `dataset.itemId`, `loading="lazy"` y `decoding="async"`. El único listener delegado de Pointer Events abre un diálogo solo para taps intencionales, sin activar previews al hacer scroll.

### Imágenes y descargas

`getThumbnailUrl(sourceUrl, aspectRatio, width)` inserta `f_avif,q_auto,c_fill,g_auto`, la relación de aspecto y el ancho inmediatamente después de `/image/upload/`. Lo comparten las tarjetas de Tienda y Colección, además del preview de 1200 px. Al fijar `f_avif`, esas vistas requieren un navegador con decodificador AVIF: no reciben el fallback automático asociado a `f_auto`. Si la URL no tiene el formato esperado, la función devuelve la original y advierte solo en desarrollo. `getImageDownloadUrl(sourceUrl)` añade `fl_attachment` para imágenes poseídas. Los archivos usan `downloadUrl`; ambas descargas se inician con un enlace temporal y mantienen el evento `click_download` con fuente `"colección"`.

### Compra y promoción

El preview utiliza una imagen optimizada y la confirmación mantiene la autoridad económica en `GameCenter.buyItem(item)`: el **Total** es el precio tras descuento y el cashback es una devolución separada. Los eventos `view_preview` y `buy_item` usan `item.category` como categoría estable.

El formulario de promociones pertenece al panel `Perfil → Códigos promocionales`; este módulo solo conecta sus controles con `GameCenter.redeemPromoCode()` y gestiona foco al entrar y volver del panel.

### API pública

```javascript
window.ShopView = {
  onEnter(),
  onLeave()
};
```

`SpaRouter` llama `onEnter()` al navegar a Tienda. La carga del catálogo, Colección y sus listeners no se reinicializan en cada visita.

## 10. js/spa-router.js — Router SPA

Módulo IIFE responsable exclusivo de la navegación entre vistas.

### API pública

```javascript
window.SpaRouter = {
    navigateTo(viewId, anchor?, replace?),  // Navega a 'home' o 'shop'
    getCurrentView()                         // Devuelve el id de la vista activa
};
```

### `navigateTo(viewId, anchor?, replace?)`

```javascript
SpaRouter.navigateTo('shop');         // Ir a Tienda (pushState)
SpaRouter.navigateTo('home', 'faq'); // Ir a Inicio y scroll a #faq (pushState)
SpaRouter.navigateTo('home', null, true); // Estado inicial (replaceState)
```

Pasos internos al llamar a `navigateTo`:

1. `history.pushState({ viewId, anchor })` — registra la entrada en el historial (o `replaceState` si `replace=true`).
2. Llama a `_applyView(viewId, anchor)` con la lógica de transición visual.

### `_applyView(viewId, anchor)` — transición pura

Función interna que aplica la transición SIN tocar el historial. Es la que llama el handler de `popstate` para evitar un bucle de entradas:

1. Alterna `.hidden` entre `#view-home` y `#view-shop`.
2. Actualiza clases `.active` en navbar y bottom-nav.
3. Llama a `window.GameCenter.syncUI()`.
4. `window.scrollTo({ top: 0, behavior: 'instant' })` o scroll suave al anchor.
5. **[v9.6]** Llama a `onLeave()` de la vista que se abandona (`ShopView.onLeave()` al ir a Home, `HomeView.onLeave()` al ir a Shop).
6. Ejecuta el callback de vista entrante: `window.HomeView.refresh()` o `window.ShopView.onEnter()`.

> **[v9.6 — SVG Sprite]** Se eliminó el paso `lucide.createIcons()` que existía entre los pasos 3 y 4. Los iconos son ahora SVG Sprite estáticos presentes desde el primer frame de la transición.

> **[v9.6 — Smart Preload]** El paso 5 (`onLeave`) permite a `ShopView` desconectar el `IntersectionObserver` de precarga al abandonar la vista, liberando referencias a nodos DOM que pueden haber cambiado.

### History API — botón Atrás/Adelante (v9.1)

```javascript
// Al cargar la página — registrar estado inicial
navigateTo('home', null, /* replace= */ true);
// → history.replaceState({ viewId: 'home', anchor: null }, '')

// Al navegar a Tienda — registrar nueva entrada
navigateTo('shop');
// → history.pushState({ viewId: 'shop', anchor: null }, '')

// Al pulsar Atrás — restaurar vista anterior SIN pushState
window.addEventListener('popstate', (e) => {
    const viewId = VIEWS.includes(e.state?.viewId) ? e.state.viewId : 'home';
    _applyView(viewId, e.state?.anchor || null); // ← sin pushState
});
```

**Por qué `_applyView` en popstate y no `navigateTo`:** si usáramos `navigateTo` en el handler popstate, generaríamos un nuevo pushState por cada Atrás, creando un historial infinito que nunca permitiría salir de la app.

### Sin reflows

La transición usa únicamente la clase `.hidden` (`display: none !important`). No se animan propiedades de layout.

---

## 11. styles.css — Sistema de Diseño Arcade Solid 3.1

### Filosofía de Diseño (v10.1)

### Filosofía de Diseño (v10.1)

A partir de v10.0 el sistema visual abandona el Glassmorphism y adopta un diseño **Sólido Premium** de ratio 90/10. En v10.1 se refinan dos puntos adicionales: eliminación de artefactos de esquina y sistema de transiciones de vista GPU-only.

- **90% Sólido:** Todas las superficies de panel, navegación, tarjetas y entradas usan fondos de color sólido oscuro. La jerarquía de profundidad se comunica mediante bordes de acento (hard-edge) y sombras cortas sólidas.
- **10% Glass:** El `backdrop-filter` está permitido *solo* en elementos flotantes críticos (toasts, modales de confirmación, identity modal).
- **GPU-First:** Ninguna animación toca `height`, `width` o `margin`. Solo `opacity`, `transform` y opcionalmente `filter`. La regla de los 300ms se cumple en todas las transiciones.

**Beneficio de rendimiento:** eliminar el `backdrop-filter` de navbar, bottom-nav y todos los paneles reduce ~30-50% el overdraw en dispositivos gama baja/media.

### Principio Mobile-First

A partir de v8.0, los estilos base en `styles.css` corresponden al viewport más pequeño (pantalla de teléfono). Las expansiones para pantallas más grandes se definen con media queries de tipo `min-width`.

```css
/* ANTES (v7.5): Desktop como base, mobile como excepción */
.shop-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }

@media (max-width: 768px) {
    /* overrides de mobile */
}

/* AHORA (v8.0): Mobile como base, desktop como expansión */
.shop-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }

@media (min-width: 768px) {
    .shop-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
}
```

### Breakpoints

| Breakpoint | Valor | Descripción |
|---|---|---|
| Base (mobile) | — | Teléfonos (< 768px) |
| Desktop | `min-width: 768px` | Tablets y escritorios |
| Desktop wide | `min-width: 1024px` | Escritorios grandes |

### Cambios clave por componente

**Body:**
- Mobile base: `padding-bottom: var(--bottom-nav-height)` (espacio para bottom nav)
- Desktop: `padding-bottom: 0`

**Bottom Nav:**
- Mobile base: `display: flex` (visible)
- Desktop: `display: none` (oculto)

**Nav Links (top):**
- Mobile base: `display: none`
- Desktop: `display: flex`

**`.shop-hero` (Hero Balance):**
- Mobile base: `display: none` — eliminado visualmente en móvil porque el saldo ya está en la Navbar superior
- Desktop: `display: flex`

**`.shop-grid`:**
- Mobile base: `repeat(2, 1fr); gap: 12px` — 2 columnas compactas
- Desktop: `repeat(auto-fill, minmax(220px, 1fr)); gap: 20px`

**`.shop-card`:**
- Mobile base: `padding: 12px`
- Desktop: `padding: 18px`

**`.shop-img`:**
- Mobile base: `height: 120px`
- Desktop: `height: 170px`

**`.section-title`:**
- Mobile base: `font-size: 1.4rem`
- Desktop: `font-size: 1.8rem`

**`.shop-tab`:**
- Mobile base: `padding: 8px 10px; font-size: 0.78rem`
- Desktop: `padding: 10px 18px; font-size: 0.88rem`

**`.promo-input-group`:**
- Mobile base: `flex-direction: column` (apilado)
- Desktop: `flex-direction: row`

**`.theme-grid`:**
- Mobile base: `grid-template-columns: 1fr 1fr` (2 columnas)
- Desktop: `repeat(auto-fill, minmax(150px, 1fr))`

**`.faq-grid`:**
- Mobile base: `grid-template-columns: 1fr`
- Desktop: `repeat(auto-fill, minmax(340px, 1fr))`

**`.toast`:**
- Mobile base: `bottom: calc(var(--bottom-nav-height) + 10px)` — sobre la bottom nav
- Desktop: `bottom: 30px`

### Tokens de Superficie (v10.0)

```css
/* Superficies sólidas (Arcade Solid 3.0) */
--solid-surface-base:  #0f1018;   /* Paneles base: settings, cards */
--solid-surface-float: #141620;   /* Elementos flotantes: HUD, game cards */
--solid-surface-hi:    #1a1d2e;   /* Highlight: modal box */
--solid-surface-deep:  #0a0b12;   /* Profundidad máxima: inputs, balance */

/* Bordes hard-edge */
--border-subtle:  rgba(255,255,255,0.06);   /* Bordes neutros */
--border-mid:     rgba(255,255,255,0.10);   /* Bordes medios (identidad) */
--border-bright:  rgba(255,255,255,0.18);   /* Bordes de highlight */
```

Los tokens `--glass-base-bg`, `--glass-float-bg` etc. son mantenidos como **alias** a los valores sólidos para compatibilidad retroactiva.

### Animaciones GPU (v10.0)

Todas las nuevas animaciones usan propiedades compositor-only para evitar repaints:

| Animación | Elemento | Propiedad animada | FPS garantizado |
|---|---|---|---|
| `powerRingRotate` | `.hud-avatar-ring` | `transform: rotate()` | 60fps |
| `laserScan` | `.sale-banner__ticket::after` | `transform: translate3d()` | 60fps |

Ambas tienen `will-change: transform` para promoverse a capas GPU antes del primer frame.

---

### Clases nuevas en v8.0

**`.sync-separator`** — Separador visual entre métodos de importación:
```css
.sync-separator { display: flex; align-items: center; gap: 10px; margin: 12px 0; font-size: 0.78rem; color: var(--text-low); }
.sync-separator::before, .sync-separator::after { content: ''; flex: 1; height: 1px; background: var(--glass-border); }
```

**`.file-label`** — Label del input de archivo estilizado como botón ghost:
```css
.file-label { cursor: pointer; width: 100%; justify-content: center; padding: 10px; }
```

**`.card-name` y `.card-desc-text`** — Clases CSS para los textos de cards (v8.0 reemplaza inline styles para facilitar overrides responsive):
```css
.shop-card .card-name { font-size: 0.9rem; font-weight: 700; /* desktop: 1.02rem */ }
.shop-card .card-desc-text { font-size: 0.76rem; -webkit-line-clamp: 2; /* desktop: 0.82rem, clamp 3 */ }
```

**`.moon-blessing-badge`** — Actualizado para ser compatible con el icono SVG Sprite:
```css
.moon-blessing-badge {
    display: inline-flex; align-items: center; justify-content: center;
    filter: drop-shadow(0 0 6px rgba(192, 132, 252, 0.8));
    animation: moonPulse 2.5s ease-in-out infinite;
}
```

---

## 12. Códigos Promocionales (SHA-256)

### Dónde canjearlos

El canje se realiza desde **Perfil → Códigos promocionales**. La Tienda no contiene controles de promociones. El panel dedicado mantiene el mismo formulario, feedback accesible y la lógica centralizada en `GameCenter.redeemPromoCode()`.

### Cómo funcionan

Los códigos promocionales se almacenan en `PROMO_CODES_HASHED` como hashes SHA-256. El usuario escribe el código, se hashea en el cliente y se compara contra el diccionario. El texto plano nunca se almacena ni se compara directamente.

### Agregar un código nuevo

**Paso 1 — Calcular el hash SHA-256 (siempre en MAYÚSCULAS, sin espacios):**

```bash
# Linux / macOS
echo -n "MICODIGO" | sha256sum

# Python (multiplataforma)
python3 -c "import hashlib; print(hashlib.sha256(b'MICODIGO').hexdigest())"
```

**Paso 2 — Añadir la entrada en `app.js`:**

```javascript
const PROMO_CODES_HASHED = {
    // ... entradas existentes ...
    'HASH_DE_64_CARACTERES': 150,   // MICODIGO → 150 monedas
};
```

> ⚠️ El código que el usuario escribe se normaliza con `.trim().toUpperCase()`. El hash debe calcularse del texto **exactamente en mayúsculas y sin espacios**.

### Lista de hashes actuales

| Hash SHA-256 (primeros 16 chars) | Monedas | Código original |
|---|---|---|
| `4564f1daae1dd157` | 2500 | PVZGW2500 |
| `5136694194f15aec` | 500 | PVZGW500 |
| `fe499ddb40f6bf77` | 1000 | BOCCHICAT1000 |
| `aec9091f68e1f132` | 1000 | 09112024 |
| `a6670a5454af70c9` | 200 | VERSION9 |
| `02d936b1e7ecebb0` | 13000 | PAGO_QA |
| `fc4cbe30d1379fac` | 1200 | FIX_REWARD_120426 |
| `5c9808d0e5afe7cd` | 1000 | SOLECITO |
| `ec029eed55db3414` | 1000 | LUNITA |
| `f28aab1b9b359e78` | 6000 | HACO260526 |
| `2bf4c2eb61f4e857` | 2000 | HLSEPENM |
| `85b7e539867d4e35` | 2800 | MIKU9X0L |
| `6e64009694ee0e03` | 1500 | YORHA2B |
| `90054feb0a9c7293` | 2600 | LOVEARCADE140 |
| `fadb13b212d99b00` | 3000 | RACHA150 |

> Los hashes completos (64 caracteres) se encuentran en `PROMO_CODES_HASHED` dentro de `app.js`.

---

## 13. Sistema de Racha (Streaks)

### Cambio en v8.1: Día Natural vs. 24 horas exactas

Hasta v8.0, el sistema verificaba si habían pasado ≥ 86.400.000 ms desde el último reclamo. Esto producía un "desplazamiento de horario": si el usuario reclamaba a las 23:55, debía esperar hasta las 23:55 del día siguiente.

A partir de **v8.1**, la comparación se realiza por **día calendario** (medianoche contra medianoche):

```javascript
// Normalizar ambas fechas a las 00:00:00.000 de su día
const nowMidnight  = new Date(now).setHours(0, 0, 0, 0);
const lastMidnight = new Date(lastClaim).setHours(0, 0, 0, 0);
const diffDays     = Math.round((nowMidnight - lastMidnight) / 86_400_000);
```

**Fórmula de racha:**

| `diffDays` | Acción |
|---|---|
| `0` | Ya reclamado hoy. No se otorga recompensa. |
| `1` | Racha continúa: `streak + 1`. |
| `> 1` | Racha interrumpida: `streak = 1`. |

Esto garantiza que un usuario que reclamó a las **23:59** puede volver a reclamar a las **00:01** del día siguiente (diff = 1 → racha continúa).

**Fórmula de recompensa base** (sin cambios):

`recompensa = min(20 + (streak - 1) × 5, 60)`

| Día de racha | Recompensa base |
|---|---|
| 1 | 20 |
| 2 | 25 |
| 3 | 30 |
| 4 | 35 |
| 5 | 40 |
| 6 | 45 |
| 7+ | 60 (tope) |

---

## 14. Bendición Lunar

Sin cambios funcionales en v8.0. La representación visual migra de emoji a icono SVG Sprite (v9.6).

| Parámetro | Valor |
|---|---|
| Costo de activación | 100 monedas |
| Efecto | +90 monedas por cada reclamo diario |
| Vigencia | 7 días reales desde la activación |
| Indicador UI | Icono `<svg class="icon"><use href="#icon-moon">` animado junto al saldo |

### Comportamiento v9.6: Bendición Lunar sin dependencia de red

Desde v9.6, el bonus de Bendición Lunar **siempre se concede** mientras el buff esté activo, sin condiciones de red:

```javascript
moonBonus = moonActive ? 90 : 0
```

La protección contra abuso queda cubierta por el `desynced` del sync en background: si el usuario adelanta el reloj para hacer pasar un día, el sync detectará la discrepancia y bloqueará el reclamo completo (no solo el bonus lunar). Sin conexión genuina, el usuario tampoco puede comprar la Bendición Lunar (requiere 100 monedas que se obtienen jugando), por lo que el riesgo neto es despreciable.

---

## 16. Sincronización con BackupEngine (.labak)

### Flujo de exportación (v15.0)

```
Clic "Exportar y descargar"  →  handleExport() async
    │
    ▼
BackupEngine.exportBackup()
    │
    ▼  [colección dinámica de localStorage + claves conocidas]
envelope = { version, format, createdAt, source, keys, keyCount }
    │
    ▼
checksum = sha256(JSON.stringify(envelope))
payload  = JSON.stringify({ ...envelope, checksum })
gzip(payload) mediante CompressionStream (en worker cuando está disponible)
    │
    ▼
Blob(binary/gzip) → URL.createObjectURL() → descarga LoveArcade_Backup_YYYY-MM-DD.labak
    │
    ▼
Mensaje: "Copia de seguridad creada"
```

> **Sin portapapeles y sin textarea.** El respaldo ya no usa texto Base64 pegable; todo el flujo es binario comprimido para reducir tamaño (especialmente en avatares serializados como Data URL).

### Flujo de importación (v15.0)

**Política de compatibilidad de extensiones**

- **Estándar vigente:** `*.labak` (formato recomendado para respaldos nuevos).
- **Compatibilidad legada en importación:** `*.labak.gz` (se acepta para no romper respaldos históricos).

```
Usuario selecciona archivo .labak o .labak.gz  →  evento 'change' en #import-file
    │
    ▼
Usuario hace clic en "Importar progreso"  →  handleImport() async
    │
    ▼
BackupEngine.importBackupFromFile(file)
    │
    ▼  [DecompressionStream + JSON.parse + SHA-256]
¿checksum válido? → restaurar cada clave en localStorage → reload
¿inválido?        → rechazado con mensaje de error
```

---

## 17. Historial de Transacciones

Sin cambios en v8.0. Cada operación que modifica el saldo genera una entrada en `store.history`:

```javascript
{ tipo: 'ingreso', cantidad: 500, motivo: 'Código canjeado',       fecha: timestamp }
{ tipo: 'gasto',   cantidad: 88,  motivo: 'Compra: Rouge the Bat',  fecha: timestamp }
{ tipo: 'ingreso', cantidad: 9,   motivo: 'Cashback: Rouge the Bat', fecha: timestamp }
```

El store mantiene un máximo de 50 entradas (reducido desde 150 en v14.1, ver §2af). La pestaña Ajustes muestra las 50 más recientes con scroll.

### 17.1 Checklist de accesibilidad — Daily Streak Hub

El hub conserva el botón nativo `#btn-daily`, por lo que se puede enfocar con Tab y activar con Enter o Espacio. Antes de publicar cambios en este flujo, comprobar:

- [ ] El nombre accesible del botón es **«Reclamar bono diario»** o, cuando corresponde, **«Reparar racha diaria»**.
- [ ] `#daily-msg` conserva `role="status"` y `aria-live="polite"`; el resultado del reclamo debe anunciarse desde ese único canal.
- [ ] La llama decorativa `#streak-flame` permanece fuera del árbol de accesibilidad con `aria-hidden="true"` y `aria-live="off"`.
- [ ] `.streak-hub-number` y `#streak-days` exponen la racha actual mediante sus etiquetas `aria-label` dinámicas.
- [ ] Al navegar con teclado, `.streak-hub-cta:focus-visible` muestra el anillo de foco basado en `--focus-ring-aa`.
- [ ] El color más oscuro de los gradientes de los números `available` y `claimed` mantiene, como mínimo, contraste 3:1 frente a `--solid-surface-float`.

---

## 18. Flujos de Usuario

### Flujo de Bono Diario (v9.6 — Background Sync)

```
[Al cargar la página / volver a la pestaña / cada 30 min]
    │
    ▼ [SILENCIOSO — no bloquea la UI]
_syncTimeBackground()
    ├── Promise.any([timeapi.io, worldtimeapi.org])  timeout: 4 s
    ├── Éxito  → _writeTimeCache({ drift, desynced })
    └── Error  → caché anterior se conserva intacto


[Usuario hace clic en #btn-daily]
    │
    ▼ [INSTANTÁNEO — sin red]
_readTimeCache()  →  { time, verified, desynced }  (localStorage)
    │
    ▼ [Validaciones en orden]
1. now < lastClaim?
   └── SÍ → "Se detectó una inconsistencia horaria…"  [racha intacta]
2. desynced === true?  (detectado en el sync anterior)
   └── SÍ → "Reloj desincronizado…"  [bloqueo]
3. diffDays === 0? (mismo día calendario)
   └── SÍ → "¡Ya reclamaste tu bono hoy!"  [bloqueo]
4. moonBonus = moonActive ? 90 : 0
    │
    ▼
Recompensa entregada instantáneamente · UI actualizada
```
    ▼ [diffDays >= 1 → reclamo válido]
diffDays === 1 → streak + 1
diffDays  > 1 → streak = 1
    │
    ▼
baseReward = min(20 + (streak-1)×5, 60)
moonBonus  = verified && moonActive ? 90 : 0
totalReward = baseReward + moonBonus
    │
    ▼
store.coins += totalReward  ·  store.daily = { lastClaim: now, streak }
logTransaction(...)  ·  saveState()
    │
    ▼
updateDailyButton()  →  restaura el botón al estado correcto
                         (desactivado con contador si el reclamo fue exitoso,
                          habilitado si falló por error recuperable)
```

### Flujo de sincronización (v8.0)

```
EXPORTAR
────────
Clic "Exportar y descargar"
    │
    ├── clipboard.writeText(code)  →  código en portapapeles
    └── Blob → download  →  love-arcade-backup-2026-02-21.txt

IMPORTAR
────────
Opción A: Cargar archivo .txt
    │
    FileReader.readAsText() → textarea.value = código
    └── Clic "Importar progreso" → handleImport() → importSave(code)

Opción B: Pegar código en textarea
    └── Clic "Importar progreso" → handleImport() → importSave(code)

importSave(code)
    │
    ├── workerTask({action:'import', code, salt})
    ├── ¿checksum válido? → migrateState(data) → saveState() → reload
    └── ¿inválido?        → "El código fue modificado manualmente."
```

---

## 19. Guía de Mantenimiento

### Agregar un ítem de Tienda

1. Sube la imagen fuente a Cloudinary y conserva su URL original con la forma `https://res.cloudinary.com/<cloud>/image/upload/<public_id>`.
2. Añade una entrada a `data/shop.json` con `id` único y estable, `name`, `price`, `category: "art"`, `type` e `imageUrl`. Para `type: "file"`, añade además `downloadUrl` directo.
3. No añadas transformaciones Cloudinary, `tags`, `file`, requisitos ni categorías de regalos al JSON: las miniaturas y las descargas de imágenes se resuelven en cliente.
4. Ejecuta `node tests/shop-catalog-static-qa.mjs` antes de publicar.

### Activar una oferta especial

Editar el objeto `ECONOMY` en `app.js`. Ver `ECONOMIA.md` para referencia completa.

### Agregar un código promo nuevo

1. Calcular hash: `python3 -c "import hashlib; print(hashlib.sha256(b'MICODIGO').hexdigest())"`.
2. Añadir `'<hash>': <monedas>` en `PROMO_CODES_HASHED` dentro de `app.js`.

### Mantener la Tienda

1. Añade o modifica entradas de `data/shop.json` respetando el contrato de la sección 7.
2. Conserva los IDs publicados y revisa `data/retired-shop-gift-ids.json` antes de reutilizar un identificador histórico.
3. Ejecuta `node tests/shop-catalog-static-qa.mjs` para validar tanto los datos como las garantías estáticas de interfaz.
4. Configura descuentos y cashback desde `ECONOMY` en `js/app.js`; la señal visual de oferta es el pill de cada tarjeta y el desglose de compra.
5. Añade promociones mediante los hashes descritos en la sección 12; su acceso visible está en Perfil.

## 20. Seguridad y Limitaciones

| Aspecto | Estado v8.1 | Detalle |
|---|---|---|
| **Códigos promo** | ✅ Protegidos | Hash SHA-256. El texto plano no es visible en el código fuente. |
| **Integridad de sync** | ✅ Checksum | Partidas editadas manualmente son rechazadas al importar (incluyendo archivos .txt). |
| **Manipulación del saldo** | ⚠️ Posible | Un usuario puede editar `localStorage` directamente. Aceptable por diseño en plataforma de confianza. |
| **Importación de archivos** | ✅ Validado | FileReader solo lee el contenido; sync-worker.js verifica el checksum SHA-256 antes de aplicar. |
| **LocalStorage key** | ✅ Intocable | `'gamecenter_v6_promos'` no debe modificarse jamás para no perder el progreso de usuarios existentes. |
| **Bono diario — reloj local** | ✅ Mitigado | `_syncTimeBackground()` contrasta el reloj con dos APIs en paralelo. Si detecta > 5 min de diferencia, escribe `desynced: true` en el caché; `claimDaily()` bloquea el reclamo en el siguiente intento. |
| **Bono diario — modo offline** | ✅ Mejorado v9.6 | Sin conexión, `claimDaily()` usa el caché existente (TTL 4 h). Si el caché expiró y no hay red, el reclamo se permite con `verified: false` (comportamiento graceful). |
| **Rate limiting / CORS API tiempo** | ✅ Resuelto v9.6 | El sync corre en background sin bloquear la UI. Errores de red son silenciosos; el caché previo actúa como buffer. timeapi.io como primaria elimina los 429 de worldtimeapi.org. |
| **Latencia en el reclamo** | ✅ Eliminada v9.6 | `claimDaily()` es 100% síncrono. El usuario recibe la recompensa instantáneamente sin ninguna espera de red. |
| **Salto negativo de reloj** | ✅ Detectado | Si `now < lastClaimTime`, el reclamo se bloquea con mensaje informativo. La racha no se reinicia. |
| **Double-tap / race condition** | ✅ Prevenido | El botón `#btn-daily` se desactiva síncronamente antes de cualquier `await`, imposibilitando múltiples reclamos simultáneos. |

---

## 21. Compatibilidad

| Tecnología | Versión mínima |
|---|---|
| Chrome | 89+ (SubtleCrypto, Workers, Clipboard API, FileReader) |
| Firefox | 87+ |
| Safari | 15+ |
| Edge | 89+ |
| Hosting | Cualquier servidor estático (GitHub Pages, Netlify) |
| Backend | Ninguno |
| Dependencias | canvas-confetti (CDN) — único CDN externo desde v9.6 |

> La `Clipboard API` (`navigator.clipboard.writeText`) requiere HTTPS o localhost. En entornos sin HTTPS, `handleExport()` tiene un fallback con `document.execCommand('copy')`. Si ambos fallan, el archivo `.txt` igualmente se descarga.

---

## 22. Glosario

| Término | Definición |
|---|---|
| **Store** | El objeto JavaScript en memoria que contiene todo el estado del usuario. Se persiste en `localStorage`. |
| **GameCenter** | La API pública (`window.GameCenter`) con todos los métodos del motor. |
| **Checksum** | Hash SHA-256 del store exportado, incluido en el código/archivo de sincronización para detectar edición manual. |
| **Mobile-First** | Estrategia de CSS donde los estilos base aplican a pantallas pequeñas y los overrides se definen con `@media (min-width: ...)`. |
| **Hero Balance** | El banner grande de monedas en la parte superior de la tienda. Oculto en móvil (v8.0). |
| **Racha / Streak** | Días consecutivos en que se reclama el bono diario. Determina la recompensa escalonada. |
| **Bendición Lunar** | Buff temporal de +90 monedas por reclamo diario. Costo 100 monedas, vigencia 7 días. |
| **Skeleton Screen** | Placeholder visual con animación de pulso que imita la estructura de las cards mientras carga el JSON. |
| **Debounce** | Técnica que retrasa la ejecución de una función hasta que el usuario deja de interactuar. Usado en la búsqueda. |
| **Cashback** | Devolución automática de un porcentaje de monedas tras cada compra. |
| **SYNC_SALT** | Constante interna usada para calcular checksums de sincronización. |
| **migrateState** | Función que fusiona el store cargado con los defaults de la versión actual sin sobrescribir datos. |
| **stateKey** | La clave de `localStorage`: `'gamecenter_v6_promos'`. No debe modificarse jamás. |
| **FileReader** | API nativa del navegador para leer archivos locales de forma asíncrona y no bloqueante. Usada en la importación de partidas. |
| **Blob** | Objeto de datos binarios utilizado para generar el archivo `.txt` de exportación sin necesidad de un servidor. |
| **_syncTimeBackground** | Función async (v9.6) que consulta timeapi.io y worldtimeapi.org en paralelo y escribe el resultado en el caché de tiempo. Se ejecuta en background sin bloquear la UI. |
| **_readTimeCache** | Función síncrona (v9.6) que lee el caché de tiempo del localStorage y devuelve la estimación de tiempo de red. Usada por `claimDaily()`. |
| **TIME_CACHE_KEY** | Clave de localStorage (`love_arcade_time_cache`) donde se almacena el caché de tiempo. Separada del store principal. |
| **TIME_CACHE_TTL** | TTL del caché de tiempo: 4 horas. Mientras el caché sea más reciente, `claimDaily()` lo usa directamente. |
| **verified** | Campo de `_readTimeCache()`. `true` si el caché existe y tiene menos de 4 horas. |
| **desynced** | Campo de `_readTimeCache()`. `true` si el último sync detectó que el reloj local superaba `CLOCK_SKEW_LIMIT`. |
| **Día Natural** | Modelo de reset de bono diario (v8.1) basado en días calendario (medianoche). Reemplaza el contador de 24 h exactas. |
| **Race condition** | Condición de carrera donde múltiples clics rápidos disparan varias llamadas a `claimDaily()`. Prevenida en v8.1 desactivando el botón síncronamente. |
| **CLOCK_SKEW_LIMIT** | Constante (5 min en ms). Umbral máximo de discrepancia tolerable entre reloj local y de red. |

---



---

## 2r. Novedades en v9.8 — Mobile Performance Pass (Scroll & Modal Lag)

### Motivación

En dispositivos táctiles de gama baja y media se reportaban dos problemas de rendimiento:

1. **Lag de scroll en la sección Tienda**: al hacer scroll rápido sobre el catálogo de wallpapers, el hilo principal se saturaba causando frames caídos y "trabas" visuales.
2. **Freeze al abrir el modal de preview**: al tocar "Ver preview" en una card, la UI se congelaba 50–150 ms antes de que el modal apareciera, haciendo que la animación de entrada nunca se viera.

Ambos problemas tenían causas independientes. La v9.8 los resuelve de forma quirúrgica sin tocar la lógica de negocio.

---

### Causa raíz — Scroll lag

#### 1. `backdrop-filter` en overlays no excluidos de `@media (pointer: coarse)`

El bloque `@media (pointer: coarse)` existente solo desactivaba `backdrop-filter` en los elementos internos del mockup (`.mockup-app-icon`, `.mockup-taskbar`). Los overlays más costosos quedaban activos en móvil:

| Elemento | Blur anterior | Blur v9.8 en táctil |
|---|---|---|
| `.modal-overlay` (confirm/buy) | `blur(4px)` | `none` |
| `.identity-modal-overlay` | `blur(4px) brightness(0.4)` | `none` + `background` más opaco |
| `.preview-close-btn` (botón ✕) | `blur(8px)` | `none` |
| `.toast` | `blur(12px)` | `none` |

En cada apertura de modal, `backdrop-filter` captura la escena completa detrás del overlay y la desenfoca en la GPU — operación equivalente a rasterizar toda la página dos veces. En gama baja esto cuesta 40–120 ms/frame y hace imposible mantener 60 fps. El fondo sólido ya presente (`rgba(0,0,0,0.82+)`) proporciona la ocultación visual necesaria sin coste.

#### 2. `will-change: transform` permanente en `.sale-banner__ticket::after`

La animación `laserScan` del banner de oferta tiene `will-change: transform` declarado de forma permanente. Esto crea una capa GPU dedicada para el pseudo-elemento que **el compositor debe recomponer en cada frame de scroll**, aunque el banner esté fuera del viewport.

**Fix v9.8 en `@media (pointer: coarse)`:**
```css
.sale-banner__ticket::after {
    animation: none;
    opacity: 0;
}
```
El efecto laser es inapreciable en pantallas OLED de alta tasa de refresco en móvil. Eliminarlo libera la capa GPU y el scroll del catálogo opera a compositor puro.

#### 3. `box-shadow` en la transición de `.shop-card`

`box-shadow` no es una propiedad compositor-only: cada cambio activa un pase de repaint en el área de la tarjeta. La transición anterior incluía `box-shadow 0.2s ease` que se evaluaba en cada frame de hover/tap-release.

**Fix v9.8 (todos los dispositivos):**
```css
/* Antes */
transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
/* Después */
transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
```

#### 4. Falta de hints de scroll para el browser

Sin `overscroll-behavior-y` ni `touch-action` declarados, el browser debe mantener el scroll chaining con el body y evaluar gestos horizontales en cada evento touch, añadiendo overhead de hit-testing.

**Fix v9.8:**
```css
#view-shop {
    overscroll-behavior-y: contain;  /* elimina rebote hacia el body */
    touch-action: pan-y;             /* descarta hit-testing horizontal */
}
```

---

### Causa raíz — Modal de preview lag

#### `_buildMockupHTML()` bloqueaba el hilo principal antes de que el modal fuera visible

**Flujo anterior (v9.7 y previas):**
```
tap "Ver preview"
→ _buildMockupHTML()  ← 16 SVG inline, 3 layers, DOM pesado — 50–150 ms en gama baja
→ image loading setup
→ action buttons
→ modal.classList.remove('hidden')  ← el modal aparece ya en su posición final
→ modalPopIn animation arranca demasiado tarde — el usuario percibe freeze, no animación
```

El browser no puede pintar el modal hasta que el hilo principal quede libre. Toda la construcción de DOM bloqueaba la respuesta visual.

**Flujo v9.8 (dos fases):**
```
tap "Ver preview"
→ slot.innerHTML = ''                  ← limpiar contenido anterior (<0.1 ms)
→ nameEl.textContent = item.name       ← texto puro (<0.1 ms)
→ actionsEl.innerHTML = botones        ← DOM mínimo (~1 ms)
→ modal.classList.remove('hidden')     ← VISIBLE en <2 ms total
→ [browser pinta frame 1: overlay + modalPopIn animation comienza] ← 16 ms
→ requestAnimationFrame()
   → _buildMockupHTML()                ← trabajo pesado (50–150 ms), overlay ya en pantalla
   → image loading setup
   → clock interval
```

El usuario ve el modal abrirse con animación fluida. El mockup aparece en el frame siguiente (~16 ms después). En la práctica, la construcción del mockup es lo suficientemente rápida para que el usuario no perciba el slot vacío durante el primer frame.

#### Reducción del blur en estados de carga del mockup (móvil)

| Estado | Blur anterior | Blur v9.8 en táctil | Coste |
|---|---|---|---|
| `.mockup-bg-loading` | `blur(10px)` + `scale(1.1)` | `blur(3px)` + `scale(1.03)` | Rasterizado ×11 menor |
| `.mockup-bg-offline::before` | `blur(40px)` | `blur(12px)` | Rasterizado ×11 menor |

El efecto de "thumbnail difuminada" se mantiene visualmente igual a 3 px de blur. La diferencia es imperceptible al ojo humano pero representa un factor ×11 de reducción en el coste de rasterizado del filtro.

---

### Resumen de cambios por archivo

#### `styles.css`

| Cambio | Selector | Mecanismo |
|---|---|---|
| Añadido `overscroll-behavior-y: contain` + `touch-action: pan-y` | `#view-shop` | Hints de scroll al browser |
| Eliminado `box-shadow` de la transición | `.shop-card` | Evita repaint en tap-release |
| Desactivado `laserScan` + `will-change` | `.sale-banner__ticket::after` en `pointer:coarse` | Libera capa GPU de scroll |
| Desactivado `backdrop-filter` | `.modal-overlay`, `.identity-modal-overlay`, `.preview-close-btn`, `.toast` en `pointer:coarse` | Elimina rasterizado doble de viewport |
| Desactivado `transform`/`box-shadow` en hover | `.shop-card:hover`, `.shop-card:hover .shop-img` en `pointer:coarse` | Sin work compositor en tap-release |
| Eliminada transición en `.shop-img` | `.shop-img` en `pointer:coarse` | Reduce slots de transición evaluados |
| Reducido blur carga mockup | `.mockup-bg-loading` en `pointer:coarse` | Rasterizado ×11 menor |
| Reducido blur fallback offline | `.mockup-layer-art.mockup-bg-offline::before` en `pointer:coarse` | Rasterizado ×11 menor |

#### `shop-logic.js`

| Cambio | Función | Mecanismo |
|---|---|---|
| Modal visible antes del trabajo pesado | `openPreviewModal()` | `modal.classList.remove('hidden')` síncrono; `_buildMockupHTML()` en `rAF` |
| Botones de acción síncronos | `openPreviewModal()` | DOM mínimo construido antes del rAF para mantener foco accesible |
| Limpieza de slot antes de abrir | `openPreviewModal()` | `slot.innerHTML = ''` evita flash de contenido del modal anterior |

---

## 2s. Novedades en v9.9 — Ghost Analytics

### Objetivo

Capturar eventos de interacción en la plataforma de forma **privada, gratuita y sin backend**, enviando notificaciones en tiempo real a un canal privado de Discord mediante Webhooks HTTP.

---

### Nuevo archivo: `js/analytics.js`

Módulo autónomo de analíticas. Debe cargarse **antes** de `app.js` y `shop-logic.js` en `index.html`:

```html
<script src="js/analytics.js"></script>
<script src="js/app.js"></script>
<script src="js/shop-logic.js"></script>
<script src="js/spa-router.js"></script>
```

---

### Eventos registrados

| Nombre del evento | Dónde se dispara | Metadatos enviados |
|---|---|---|
| `view_preview` | Apertura del preview desde una tarjeta de Tienda | `{ wallpaper, categoria }` |
| `click_download` | Modal de un ítem poseído en Colección | `{ wallpaper, fuente: 'colección' }` |
| `redeem_code` | `handleRedeem()` en `shop-logic.js` y `redeemPromoCode()` en `app.js` (éxito) | `{ recompensa, código: 'XXX***' }` |
| `open_game` | Delegación global en `DOMContentLoaded` de `app.js` sobre `<a href*="games/">` | `{ juego }` |
| `detected_error` | `window.addEventListener('error')` y `'unhandledrejection'` en `analytics.js` | `{ mensaje, archivo?, línea?, tipo? }` |

---

### Arquitectura interna de `analytics.js`

#### Ofuscación del Webhook

La URL nunca aparece en texto plano en el código. Se almacena como un array de char codes XOR-eados con la clave `42` y se reconstruye en runtime mediante:

```javascript
String.fromCharCode(..._r.map(c => c ^ 42))
```

No es cifrado criptográfico; protege contra scrapers automatizados y búsquedas de texto plano, no contra DevTools.

#### Rate limiting

Máximo un evento idéntico (mismo nombre + mismos metadatos) cada **3 000 ms**. Previene spam ante doble clic, IntersectionObserver que dispara en ráfagas o bugs de re-renderizado.

```javascript
const RATE_LIMIT_MS = 3000;
```

La clave de rate limiting combina `event` + `JSON.stringify(meta)`, de modo que eventos del mismo tipo con datos distintos (ej. dos wallpapers diferentes vistos seguidos) siempre se envían.

#### Protocolo de envío

`fetch` con `keepalive: true` y `.catch(() => {})` — completamente fire-and-forget:

```javascript
fetch(_endpoint(), {
    method:    'POST',
    headers:   { 'Content-Type': 'application/json' },
    body:      JSON.stringify(payload),
    keepalive: true
}).catch(() => { /* silencioso */ });
```

`keepalive: true` garantiza que el request sobrevive a navegaciones de página sin bloquear el `unload`. Nunca se usa `await`, por lo que el caller nunca espera.

#### Degradación elegante

Todas las llamadas a `GhostAnalytics` en `app.js` y `shop-logic.js` usan optional chaining (`?.`):

```javascript
window.GhostAnalytics?.track('view_preview', { wallpaper: item.name });
```

Si `analytics.js` no se carga (fallo de red, CSP restrictiva, orden incorrecto de scripts), la llamada es un no-op que no produce ningún error.

---

### Impacto en rendimiento

| Criterio | Impacto |
|---|---|
| Hilo principal | **Cero bloqueo** — `fetch` es asíncrono y fire-and-forget |
| Tiempo al primer byte (TTFB) | **Sin impacto** — analytics.js < 4 KB minificado |
| FPS / jank | **Sin impacto** — no hay DOM manipulation, no hay `requestAnimationFrame` |
| Memoria | **Despreciable** — `_lastSent` crece máximo 5–10 entradas (una por tipo de evento) |
| Red | **Sin impacto en el usuario** — requests de ~500 B enviados al Webhook, no al CDN de la plataforma |

---

### Privacidad

- No se recopilan IDs de usuario, IPs, cookies ni ningún identificador personal.
- Los códigos promocionales se ofuscan antes de enviarse: `"PVZG***"` (primeros 3 chars + `***`).
- Los nombres de wallpaper y juego son metadatos de producto, no datos personales.
- El canal de Discord es privado y solo accesible para el propietario de la plataforma.

---

### Resumen de cambios por archivo

| Archivo | Tipo de cambio | Detalle |
|---|---|---|
| `js/analytics.js` | **Nuevo** | Módulo completo de analíticas Ghost |
| `js/app.js` | Modificado | Header v9.9, `GhostAnalytics.track('redeem_code')` en `redeemPromoCode()`, delegación `open_game` en `DOMContentLoaded` |
| `js/shop-logic.js` | Modificado | Header v9.9, `track('view_preview')` en `openPreviewModal()`, `track('click_download')` en `openPreviewModal()` y `renderLibrary()`, `track('redeem_code')` en `handleRedeem()` |
| `DOCUMENTACION.md` | Modificado | Sección §2s añadida; título y ToC actualizados a v9.9 |
| `README.md` | — | Sin cambios (el README describe la arquitectura pública; analytics es un módulo interno) |

---

---

## 2t. Novedades en v9.9.1 — Ghost Analytics: producción

### Correcciones

#### `debug(true)` no mostraba logs en eventos posteriores

**Causa:** el usuario activaba el debug mode pero los eventos subsiguientes eran bloqueados por el rate limiter (mismo evento dentro de los 3 s). `_log()` solo se llama si el evento supera el rate limiter, por lo que parecía que el modo debug no hacía nada.

**Fix:** `debug(true)` ahora vacía el cache del rate limiter (`_lastSent`) en el momento de activarse, de forma que el próximo evento de cualquier tipo se envía inmediatamente y produce logs.

```javascript
// Al activar debug, se limpia el rate limiter automáticamente
Object.keys(_lastSent).forEach(k => delete _lastSent[k]);
```

---

#### Bucle de feedback: "Failed to fetch" enviado 2 veces al inicio

**Causa:** cuando `fetch()` en `_send()` fallaba (p. ej. durante un arranque sin red), la Promise rechazada disparaba el handler `unhandledrejection`. Ese handler llamaba a `track('detected_error')`, que a su vez hacía otro `fetch()` que también fallaba, disparando un segundo evento.

**Fix:** se registra cada Promise de analytics en un `WeakSet` antes de encadenar `.then()/.catch()`. El handler `unhandledrejection` comprueba si la Promise pertenece al WeakSet y, si es así, la ignora.

```javascript
const _pendingFetches = new WeakSet();

function _send(event, meta) {
    const promise = fetch(_endpoint(), { … });
    _pendingFetches.add(promise);          // registrar como "propio"
    promise.then(…).catch(…);
}

window.addEventListener('unhandledrejection', (e) => {
    if (_pendingFetches.has(e.promise)) return; // ignorar — es nuestro
    …
});
```

---

### Mejoras de calidad

#### Clasificación de errores enriquecida

Los eventos `detected_error` ahora incluyen:

| Campo | Descripción | Ejemplo |
|---|---|---|
| `tipo` | Nombre del constructor + descripción legible | `TypeError — acceso a propiedad/método inválido` |
| `mensaje` | Mensaje del error (truncado a 120 chars) | `Cannot read properties of null` |
| `archivo` | Nombre del archivo JS + número de línea | `shop-logic.js:892` |
| `stack` | Primer frame del stack trace relevante | `openPreviewModal (shop-logic.js:872:5)` |

Los errores de carga de recursos externos (imágenes CDN, fuentes) se filtran porque no son errores de JS y contaminarían el canal. El handler comprueba `e.target !== window` para descartarlos.

Los errores de tipo "Failed to fetch" ahora incluyen la ruta de la página donde ocurrieron:

```
mensaje: Failed to fetch (página: /index.html)
tipo:    NetworkError — fallo de red o CSP
```

---

#### Nueva función `status()` para diagnóstico en producción

```javascript
window.GhostAnalytics.status()
```

Imprime en consola el estado completo del módulo:
- Si el modo debug está activo
- Todas las claves en el rate limiter y cuántos segundos quedan hasta que queden libres

Ejemplo de salida:
```
[GhostAnalytics] Estado actual
  Debug mode: false
  Rate limiter (3 claves):
  · view_preview:{…}  →  rate-limited (2s)
  · buy_item:{…}      →  libre
  · open_game:{…}     →  rate-limited (1s)
```

---

### Nuevo evento: `buy_item`

Registrado en `initiatePurchase()` de `shop-logic.js` inmediatamente después de que `GameCenter.buyItem()` retorne `{ success: true }`.

| Campo | Valor | Ejemplo |
|---|---|---|
| `wallpaper` | Nombre del item comprado | `Cyber Neon Girl` |
| `precio` | Precio final pagado (con descuento si aplica) | `450 ⭐` |
| `cashback` | Monedas devueltas, o "ninguno" | `+45 ⭐` |
| `categoría` | Primer tag del item (`Mobile`, `PC`, `General`) | `Mobile` |
| `saldo_tras` | Saldo restante después de la compra | `1230` |

Color del embed: **dorado** (`#fbbf24`) · Emoji: 🛒

---

### Tabla de eventos completa (v9.9.1)

| Evento | Emoji | Color | Dónde se dispara | Metadatos |
|---|---|---|---|---|
| `view_preview` | 👁️ | Violeta | `openPreviewModal()` — fase síncrona | `wallpaper`, `categoria` |
| `click_download` | ⬇️ | Verde | `renderLibrary()` y `openPreviewModal()` | `wallpaper`, `fuente` |
| `buy_item` | 🛒 | Dorado | `initiatePurchase()` — tras compra exitosa | `wallpaper`, `precio`, `cashback`, `categoría`, `saldo_tras` |
| `redeem_code` | 🎁 | Rosa | `handleRedeem()` y `redeemPromoCode()` | `recompensa`, `código` (ofuscado) |
| `open_game` | 🎮 | Cyan | Delegación global en `DOMContentLoaded` | `juego` |
| `detected_error` | 🚨 | Carmesí | `window.error` y `unhandledrejection` | `tipo`, `mensaje`, `archivo?`, `stack?` |

---

### Resumen de cambios por archivo (v9.9.1)

| Archivo | Cambio |
|---|---|
| `js/analytics.js` | Reescrito: feedback loop corregido, `debug()` limpia rate limiter, nueva `status()`, clasificación de errores enriquecida, `buy_item` en `EVENT_COLORS/EMOJIS` |
| `js/shop-logic.js` | Header v9.9.1, `track('buy_item')` añadido en `initiatePurchase()` |
| `DOCUMENTACION.md` | Sección §2t añadida; título y ToC actualizados a v9.9.1 |

---

## 2u. Novedades en v9.9.2 — Hardening & Error Detection

### Objetivo

Eliminar redundancias en el tracking de canjes, transformar el sistema de errores en una herramienta de diagnóstico forense, y capturar eventos de fricción de usuario que no son fallos de código pero sí señales de problemas de diseño o economía.

---

### Fix 1 — De-duplicación de `redeem_code`

**Problema:** `track('redeem_code')` se disparaba dos veces por cada canje exitoso:

1. Dentro de `app.js → redeemPromoCode()` (lógica de negocio).
2. Dentro de `shop-logic.js → handleRedeem()` (UI).

Ambas llamadas pasaban el mismo payload, generando un doble reporte en el canal de Discord.

**Causa raíz:** La lógica de negocio (`redeemPromoCode`) y la capa de UI (`handleRedeem`) ambas estaban trackando el mismo evento sin coordinación.

**Fix:** Se eliminó la llamada en `redeemPromoCode()` de `app.js`. La fuente única de verdad es `handleRedeem()` en `shop-logic.js`, que es el punto más tardío de la cadena de éxito y tiene acceso al código original para ofuscarlo.

```javascript
// app.js — redeemPromoCode() — v9.9.2
// [eliminado] window.GhostAnalytics?.track('redeem_code', { … });
// → El único disparo vive en shop-logic.js → handleRedeem()

// shop-logic.js — handleRedeem() — único punto de disparo
if (result.success) {
    // … UI updates …
    window.GhostAnalytics?.track('redeem_code', {
        recompensa: result.reward,
        código:     `${code.slice(0, 3)}***`
    });
}
```

---

### Fix 2 — `detected_error` forense con contexto de ejecución

**Problema:** Los eventos `detected_error` llegaban con `tipo`, `mensaje` y `stack`, pero sin contexto suficiente para reproducir el error (¿en qué URL? ¿con red o sin red? ¿en qué vista?).

**Solución:** Nueva función privada `_getExecutionContext()` en `analytics.js` que construye un objeto con cuatro campos de diagnóstico y se mezcla en el `meta` de cada error vía `Object.assign`.

```javascript
function _getExecutionContext() {
    const ctx = {};
    ctx.url    = window.location.href.slice(0, 120);           // ruta completa
    ctx.online = navigator.onLine ? 'sí' : 'no';              // estado de red
    const mem  = performance?.memory;
    if (mem?.usedJSHeapSize)
        ctx.mem_mb = (mem.usedJSHeapSize / 1_048_576).toFixed(1) + ' MB';
    const view = window.SpaRouter?.getCurrentView?.();
    if (view) ctx.vista = view;                                // breadcrumb SPA
    return ctx;
}
```

Los eventos `detected_error` ahora incluyen:

| Campo nuevo | Descripción | Ejemplo |
|---|---|---|
| `url` | URL completa donde ocurrió el error (máx 120 chars) | `https://…/index.html` |
| `online` | Estado de red del cliente | `sí` / `no` |
| `mem_mb` | Heap JS en uso (Chrome/Edge; omitido en Firefox/Safari) | `48.3 MB` |
| `vista` | Vista SPA activa como breadcrumb | `shop` / `home` |

> `_getExecutionContext()` nunca lanza excepciones — está envuelto en `try/catch` propio para no afectar el flujo del handler de errores.

---

### Nuevos eventos de fricción de usuario

Los siguientes eventos no son fallos de código sino señales de diseño. Se capturan para detectar problemas de UX antes de que lleguen como quejas.

---

#### `invalid_promo_code` 🔑

**Disparado en:** `shop-logic.js → handleRedeem()` cuando `result.message === 'Código inválido'`.

**No se dispara cuando:** el mensaje es `'Ya canjeaste este código'` (es un intento legítimo, no un código desconocido).

**Metadatos:**

| Campo | Descripción | Ejemplo |
|---|---|---|
| `intento` | Prefijo del código + `***` | `PVZ***` |
| `longitud` | Longitud del código introducido | `7` |

**Utilidad de diagnóstico:** Un volumen alto indica que alguien intenta adivinar códigos por fuerza bruta, o que hay un código activo que el usuario espera que funcione pero no existe en `PROMO_CODES_HASHED`.

---

#### `insufficient_funds` 💸

**Disparado en:** `app.js → buyItem()` y `app.js → buyMoonBlessing()` cuando el saldo es insuficiente.

**Metadatos:**

| Campo | Descripción | Ejemplo |
|---|---|---|
| `wallpaper` | Nombre del ítem o `'Bendición Lunar (buff)'` | `Cyber Neon Girl` |
| `precio` | Precio final que se intentó pagar | `800 ⭐` |
| `saldo` | Saldo actual del usuario | `320` |

**Utilidad de diagnóstico:** Permite calcular la brecha promedio entre precio y saldo. Si la brecha es sistemáticamente alta, los precios pueden estar mal calibrados o el flujo de generación de monedas es insuficiente.

---

#### `daily_bonus` 🌟

**Disparado en:** `app.js → claimDaily()` — solo en la rama de éxito (`success: true`). No se dispara en intentos fallidos para no saturar el canal.

**Metadatos:**

| Campo | Descripción | Ejemplo |
|---|---|---|
| `recompensa` | Total de monedas recibidas | `110` |
| `base` | Recompensa base sin buff lunar | `20` |
| `luna` | Bonus de Bendición Lunar, o `'no'` | `+90` |
| `racha` | Número de días de racha consecutivos | `5` |

**Utilidad de diagnóstico:** Mide el engagement diario real. Permite ver si la Bendición Lunar se usa y si las rachas largas son frecuentes.

---

#### `user_snapshot` 📊

**Disparado en:** `shop-logic.js → loadCatalog()` — una sola vez por sesión de navegador (guardado en `sessionStorage` bajo la clave `ga_snapshot_sent`).

**No se repite** en navigations SPA ni en retries del catálogo (`loadCatalog()` puede llamarse múltiples veces).

**Metadatos:**

| Campo | Descripción | Ejemplo |
|---|---|---|
| `saldo` | Monedas actuales del usuario | `1450` |
| `comprados` | Ítems del catálogo ya adquiridos | `3` |
| `disponibles` | Ítems del catálogo aún sin comprar | `21` |
| `racha` | Racha diaria activa | `7` |
| `códigos_canjeados` | Número de códigos promo ya usados | `2` |

**Utilidad de diagnóstico:** Proporciona una "primera impresión" del estado de cada sesión sin enviar datos redundantes. Permite calcular la riqueza promedio de los usuarios y el porcentaje de catálogo completado.

> **Nota de privacidad:** `sessionStorage` se borra al cerrar la pestaña. Si el usuario abre la app en una nueva pestaña, se envía un nuevo snapshot. Esto es intencionado: cada sesión es independiente.

---

#### `sync_export` 💾

**Disparado en:** `shop-logic.js → handleExport()` — después de que el archivo `.txt` es generado y descargado con éxito.

**Metadatos:**

| Campo | Descripción | Ejemplo |
|---|---|---|
| `portapapeles` | Si el código también fue copiado al portapapeles | `sí` / `no` |

**Utilidad de diagnóstico:** Mide cuántos usuarios utilizan la funcionalidad de sincronización entre dispositivos. Tasas bajas sugieren que la función no es visible o suficientemente comunicada.

---

### `GameCenter.getRedeemedCount()` — nuevo método

```javascript
GameCenter.getRedeemedCount() → number
```

Devuelve el número de códigos promocionales ya canjeados (longitud de `store.redeemedHashes`). Expuesto exclusivamente para que `user_snapshot` en `shop-logic.js` pueda incluir este dato sin acceder directamente al `store` privado.

---

### Tabla de eventos completa (v9.9.2)

| Evento | Emoji | Color | Dónde se dispara | Metadatos clave |
|---|---|---|---|---|
| `view_preview` | 👁️ | Violeta | `openPreviewModal()` | `wallpaper`, `categoria` |
| `click_download` | ⬇️ | Verde | `renderLibrary()` / `openPreviewModal()` | `wallpaper`, `fuente` |
| `buy_item` | 🛒 | Dorado | `initiatePurchase()` — éxito | `wallpaper`, `precio`, `cashback`, `categoría`, `saldo_tras` |
| `redeem_code` | 🎁 | Rosa | `handleRedeem()` — éxito (fuente única) | `recompensa`, `código***` |
| `open_game` | 🎮 | Cyan | delegación global `DOMContentLoaded` | `juego` |
| `detected_error` | 🚨 | Carmesí | `window.error` / `unhandledrejection` | `tipo`, `mensaje`, `archivo?`, `stack?`, `url`, `online`, `mem_mb?`, `vista?` |
| `invalid_promo_code` | 🔑 | Naranja | `handleRedeem()` — código desconocido | `intento***`, `longitud` |
| `insufficient_funds` | 💸 | Rojo | `buyItem()` / `buyMoonBlessing()` | `wallpaper`, `precio`, `saldo` |
| `daily_bonus` | 🌟 | Verde lima | `claimDaily()` — éxito | `recompensa`, `base`, `luna`, `racha` |
| `user_snapshot` | 📊 | Celeste | `loadCatalog()` — una vez por sesión | `saldo`, `comprados`, `disponibles`, `racha`, `códigos_canjeados` |
| `sync_export` | 💾 | Violeta suave | `handleExport()` — éxito | `portapapeles` |

---

### Resumen de cambios por archivo (v9.9.2)

| Archivo | Cambio |
|---|---|
| `js/analytics.js` | v9.9.2: nuevos tipos en `EVENT_COLORS/EMOJIS`, `_getExecutionContext()` helper, contexto forense en ambos handlers de error, `console.log` actualizado |
| `js/app.js` | v9.9.2: eliminado `track('redeem_code')` de `redeemPromoCode()`, `insufficient_funds` en `buyItem()` y `buyMoonBlessing()`, `daily_bonus` en `claimDaily()`, nuevo `getRedeemedCount()` |
| `js/shop-logic.js` | v9.9.2: fuente única `redeem_code` + `invalid_promo_code` en `handleRedeem()`, `user_snapshot` en `loadCatalog()`, `sync_export` en `handleExport()` |
| `DOCUMENTACION.md` | Sección §2u añadida; título, ToC y footer actualizados a v9.9.2 |

---

## 2v. Novedades en v10.0 — Shadow-Gate Developer Filter

Mecanismo de exclusión de analíticas para el desarrollador, diseñado para evitar la contaminación de datos de producción durante sesiones de prueba, QA y desarrollo local.

### Motivación

Sin este filtro, cualquier sesión de desarrollo genera eventos reales en el canal de Discord (compras de prueba, errores artificiales, snapshots de estado vacíos, etc.), contaminando las métricas de usuarios reales y dificultando el diagnóstico de tendencias genuinas.

El filtro usa un **token de alta entropía** en la URL en lugar de parámetros obvios como `?dev=true` o `?admin=1`, de modo que parece un identificador de tracking genérico en logs de red y herramientas de terceros.

---

### Implementación

#### Token y clave de sesión

```javascript
// analytics.js — constantes privadas del módulo
const _SHADOW_TOKEN = 'x92_v0id_z1';   // valor del parámetro ?ref=
const _SHADOW_KEY   = 'ghost_ignore';   // clave en sessionStorage
```

El token es opaco por diseño: no contiene palabras clave como `admin`, `dev` o `test`. El parámetro `ref` es indistinguible de un UTM de tracking en logs de red.

#### Detección al cargar (`_shadowGateInit`)

```javascript
(function _shadowGateInit() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('ref') === _SHADOW_TOKEN) {
            sessionStorage.setItem(_SHADOW_KEY, 'true');
        }
    } catch (_) { /* silencioso */ }
})();
```

Se ejecuta de forma **inmediata** al cargar `analytics.js`, antes de que cualquier evento, `DOMContentLoaded` o llamada a `track()` pueda dispararse. Si `sessionStorage` no está disponible (iframes con sandbox estricto, modo privado con restricciones estrictas), el error se captura silenciosamente y el módulo opera en modo normal.

#### Verificación en cada llamada (`_isShadowGated`)

```javascript
function _isShadowGated() {
    try {
        return sessionStorage.getItem(_SHADOW_KEY) === 'true';
    } catch (_) {
        return false;
    }
}
```

#### Salida temprana en `track()`

```javascript
function track(event, meta) {
    try {
        if (_isShadowGated()) return;   // ← Shadow-Gate: salida sin enviar nada
        // ... lógica normal
    }
}
```

Los handlers de error globales (`window.error`, `unhandledrejection`) también verifican `_isShadowGated()` antes de llamar a `track()`, silenciando por completo el módulo cuando la exclusión está activa.

---

### Persistencia

| Mecanismo | Comportamiento |
|---|---|
| **`sessionStorage`** | El flag persiste mientras la pestaña esté abierta. |
| **Navegación SPA** | Las vistas `home` / `shop` comparten el mismo origen y pestaña: el flag se mantiene. |
| **Refresco de página** | `sessionStorage` sobrevive a `F5` / `Ctrl+R` dentro de la misma pestaña. |
| **Nueva pestaña** | `sessionStorage` NO se comparte entre pestañas. Cada nueva pestaña es una sesión independiente. |
| **Cerrar pestaña** | `sessionStorage` se vacía automáticamente. La siguiente apertura opera en modo normal. |

---

### Activación

Navega a la plataforma con el token en la URL:

```
https://tudominio.com/?ref=x92_v0id_z1
```

El flag queda guardado en `sessionStorage`. A partir de ese momento, **todas las funciones de tracking de esa pestaña son no-operativas**, aunque navegues a cualquier otra ruta SPA.

Para verificar que Shadow-Gate está activo desde DevTools:

```javascript
window.GhostAnalytics.status()
// → Shadow-Gate: 🔕 ACTIVO — esta sesión está excluida de las analíticas
```

Para desactivarlo manualmente sin cerrar la pestaña:

```javascript
sessionStorage.removeItem('ghost_ignore');
// Recargar la página para que el módulo reestablezca su estado.
```

---

### Comportamiento de `test()` bajo Shadow-Gate

`test()` también respeta el filtro. En lugar de enviar un evento de prueba al Webhook, muestra un aviso en consola:

```
[GhostAnalytics] 🔕 Shadow-Gate activo — test() bloqueado.
Esta sesión está excluida de las analíticas.
Para desactivar: sessionStorage.removeItem('ghost_ignore') y recarga.
```

---

### Mensaje de carga bajo Shadow-Gate

Cuando `_isShadowGated()` es `true` al cargar el script, el mensaje de confirmación en consola cambia de verde a naranja y deja claro que el módulo está en modo silencioso:

```
// Modo normal:
[GhostAnalytics] ✅ Módulo listo (v10.0). | test(): probar Webhook | ...

// Bajo Shadow-Gate:
[GhostAnalytics] 🔕 Módulo cargado en modo silencioso (v10.0) — Shadow-Gate activo.
Esta sesión está excluida de las analíticas. | status(): ver estado | ...
```

---

### Resumen de cambios por archivo (v10.0)

| Archivo | Cambio |
|---|---|
| `js/analytics.js` | v10.0: constantes `_SHADOW_TOKEN` / `_SHADOW_KEY`, IIFE `_shadowGateInit()`, función `_isShadowGated()`, salida temprana en `track()`, verificación en ambos handlers de error globales, `test()` con aviso bajo Shadow-Gate, `status()` con campo Shadow-Gate, mensaje de carga condicional, versión actualizada a v10.0 |
| `DOCUMENTACION.md` | Sección §2v añadida; título, ToC y footer actualizados a v10.0 |

---

## 2y. [Novedades en v11.5 — Performance & Accessibility Audit](#2y-novedades-en-v115--performance--accessibility-audit)

### Resumen de la Auditoría

Se ha realizado una revisión exhaustiva del proyecto enfocada en la fluidez extrema para dispositivos de gama baja y el cumplimiento avanzado de accesibilidad (WCAG 2.2).

### Mejoras de Rendimiento

- **Carga de Fuentes No Bloqueante**: Se migró el `@import` de CSS a `<link rel="preload">` en el HTML. Esto permite que el navegador comience a pintar la interfaz mientras se descargan las fuentes, eliminando el bloqueo del renderizado inicial.
- **Content-Visibility**: Se aplicó `content-visibility: auto` a las secciones principales de la SPA. Esto permite al navegador omitir el renderizado de secciones fuera de la pantalla (como la Tienda cuando estás en Inicio), reduciendo significativamente el uso de CPU y memoria.
- **Optimización de Transiciones**: Se refinaron las animaciones de hover en tarjetas para evitar "Layout Thrashing" y se unificaron manejadores de eventos para reducir el overhead del DOM.

### Mejoras de Accesibilidad (WCAG 2.2)

- **Foco y Navegación Táctil**: Se corrigieron los inputs de archivo que eran invisibles para lectores de pantalla y difíciles de activar con teclado. Ahora usan el patrón `.visually-hidden` que mantiene la funcionalidad intacta para tecnologías asistenciales.
- **Contrastes AA**: Se ajustaron los colores de texto y acento en los temas Rosa, Cyan y Dorado para garantizar un ratio de contraste mínimo de 4.5:1, mejorando la legibilidad para usuarios con baja visión.
- **Roles ARIA**: Se añadieron etiquetas `role="status"` y `aria-live="polite"` al contador de monedas para que los cambios en el saldo sean comunicados automáticamente a los usuarios de lectores de pantalla.

### Refactorización

- **Simplificación de Lógica**: Se optimizaron funciones internas como `_getTodayString` y se marcaron métodos obsoletos para futura remoción, manteniendo el core de la aplicación ligero.

---

## 2z. Novedades en Ghost Analytics v11.0 — Doble Candado (Anti-Bot + Human Gate)

### Motivación

El sistema de analíticas enviaba reportes automáticamente al cargar la página (`onload` / `DOMContentLoaded`), lo que generaba ruido constante en el canal de Discord por tres fuentes no deseadas: visitas de bots de motores de búsqueda y auditores de rendimiento, health-checks de Vercel y monitores de uptime, y pruebas del equipo en entornos `localhost`. Esta entrega implementa un **Doble Candado** que garantiza que únicamente los eventos generados por usuarios humanos reales en producción lleguen al Webhook.

---

### Arquitectura del Doble Candado

```
track(event, meta)
    │
    ├── 0. Shadow-Gate activo?           → descarte silencioso (sesión dev excluida)
    │
    ├── CANDADO 1A: _isLocalhost()?      → descarte silencioso (localhost / 127.0.0.1)
    │
    ├── CANDADO 1B: _isBot()?            → descarte silencioso (UA en blacklist)
    │
    ├── CANDADO 2: _humanGateUnlocked?
    │     └─ false  → _pendingQueue.push({event, meta})   (max 50 items)
    │                  esperando: click | keydown | scroll
    │
    ├── Nickname disponible?
    │     └─ false  → _pendingQueue.push({event, meta})
    │                  _startNicknamePoller() cada 500 ms
    │
    ├── _isRateLimited(key)?             → descarte silencioso (< 3 s desde mismo evento)
    │
    └── _send(event, { usuario: nickname, ...meta })   ✅ ENVÍO REAL
```

---

### Candado 1A — Anti-Localhost (`_isLocalhost()`)

| Hostname detectado | Resultado |
|---|---|
| `localhost` | ⛔ Bloqueado |
| `127.0.0.1` | ⛔ Bloqueado |
| `''` (protocolo `file://`) | ⛔ Bloqueado |
| `*.local` (mDNS, Bonjour) | ⛔ Bloqueado |
| Cualquier dominio de producción | ✅ Permitido |

La verificación se evalúa en **cada llamada** a `track()`, no solo al cargar el módulo, para cubrir el caso improbable de un cambio de hostname durante la sesión.

---

### Candado 1B — Anti-Bot (`_isBot()`)

La función `_isBot()` verifica `navigator.userAgent` contra un array de 40+ patrones regex (`_BOT_UA_PATTERNS`). Las categorías cubiertas son:

| Categoría | Ejemplos de UAs bloqueados |
|---|---|
| **Motores de búsqueda** | Googlebot, Bingbot, YandexBot, Baiduspider, DuckDuckBot |
| **Auditorías de rendimiento** | Lighthouse, Chrome-Lighthouse, PageSpeed, PTST |
| **Plataformas CI/CD** | Vercel, Vercel-Screenshot |
| **Monitores de uptime** | UptimeRobot, Pingdom, StatusCake, Site24x7, GTmetrix |
| **Previews de redes sociales** | Slackbot, Twitterbot, facebookexternalhit, linkedinbot |
| **Browsers headless** | HeadlessChrome, PhantomJS, Puppeteer, Selenium, WebDriver |
| **Clientes HTTP** | curl, Wget, axios, node-fetch, python-requests |

Todos los patrones son **case-insensitive** (`/i`) para mayor robustez.

---

### Candado 2 — Human Gate (`_humanGateUnlocked`)

#### Flujo de inicialización (`_humanGateInit`)

```
Al cargar analytics.js:
    │
    ├── _getNickname() devuelve un valor?
    │     └─ SÍ  →  _humanGateUnlocked = true   ← Usuario recurrente
    │
    └─  NO  →  registrar listeners (once: true, passive: true):
                  document 'click'
                  document 'keydown'
                  window  'scroll'
                      │
                      └── Primer evento  → _unlockHumanGate()
                                              │
                                              └── _flushPendingQueue()
```

#### Cola de eventos pendientes (`_pendingQueue`)

- **Capacidad máxima:** 50 items (protección contra acumulación excesiva).
- **Descarte por capacidad:** si la cola está llena, el nuevo evento se descarta con log en modo debug.
- **Flush con nickname:** al abrir el gate, si el nickname está disponible, todos los eventos se envían inmediatamente con el rate limiter normal.
- **Flush sin nickname:** si el usuario es nuevo (en el Identity Modal), `_startNicknamePoller()` sondea localStorage cada 500 ms hasta detectar el nickname. Al encontrarlo, envía toda la cola.
- **Timeout del poller:** si el poller lleva activo más de 10 minutos sin detectar nickname, se cancela y la cola se descarta (evita pollers zombi en sesiones abandonadas).

---

### Nickname obligatorio en todos los payloads

A partir de v11.0, **todas** las peticiones al Webhook incluyen el campo `usuario` con el nickname del jugador como primer campo del embed.

```javascript
// Antes (v10.0) — meta sin identificación del usuario
_send('buy_item', { wallpaper: 'Cyber Neon', precio: 500, cashback: 50 });

// Después (v11.0) — usuario inyectado automáticamente por track()
_send('buy_item', { usuario: 'NombreJugador', wallpaper: 'Cyber Neon', precio: 500, cashback: 50 });
```

El campo `usuario` **no debe pasarse manualmente** en las llamadas a `track()` desde `app.js` o `shop-logic.js`; se inyecta siempre dentro de `track()` para garantizar consistencia.

El valor se lee con `_getNickname()` desde `localStorage['gamecenter_v6_promos'].nickname`. Si el nickname cambia durante la sesión (caso raro), las siguientes llamadas a `track()` siempre leerán el valor actualizado.

---

### Integración con `app.js` — Sin cambios funcionales

Todas las llamadas existentes a `GhostAnalytics.track()` en `app.js` son **inherentemente seguras** con el nuevo sistema:

| Llamada en `app.js` | Disparador | Compatible con Human Gate |
|---|---|---|
| `track('insufficient_funds', ...)` en `buyItem()` | Click en botón de compra | ✅ Sí |
| `track('insufficient_funds', ...)` en `buyMoonBlessing()` | Click en botón Luna | ✅ Sí |
| `track('daily_bonus', ...)` en `claimDaily()` | Click en botón diario | ✅ Sí |
| `track('open_game', ...)` en delegación de clicks | Click en link de juego | ✅ Sí |

Ninguna llamada es automática (no existe ningún `track()` dentro de `DOMContentLoaded` o en el INIT síncrono de `app.js`). El campo `usuario` no debe añadirse manualmente — `track()` lo inyecta.

---

### Integración con `shop-logic.js` — Comportamiento del `user_snapshot`

El evento `user_snapshot` (disparado automáticamente después de cargar el catálogo) queda retenido en `_pendingQueue` hasta que se cumplan ambas condiciones:

| Condición | Estado | Resultado |
|---|---|---|
| **Usuario recurrente** (tiene nickname al cargar) | Gate abierto desde el inicio | Se envía en cuanto el catálogo carga ✅ |
| **Usuario nuevo** (sin nickname, catálogo carga antes del Identity Modal) | Gate cerrado | Se encola → se envía cuando el usuario confirme su nickname en el modal ✅ |

Esto elimina definitivamente el `user_snapshot` emitido por bots o en local.

---

### Diagnóstico desde DevTools

```javascript
// Ver el estado completo del Doble Candado
window.GhostAnalytics.status()
// → muestra Shadow-Gate, Anti-Localhost, Anti-Bot, Human Gate,
//   nickname, cola pendiente, poller activo, rate limiter

// Activar logs en tiempo real
window.GhostAnalytics.debug(true)
// → Muestra en consola el estado de cada llamada a track()
//   (incluyendo descartados, encolados y enviados)

// Verificar que el Webhook funciona (incluye nickname real o '(sin nickname)')
window.GhostAnalytics.test()
// → Bloqueado en localhost y si Anti-Bot detecta UA no humano
```

---

### Resumen de cambios por archivo (Ghost Analytics v11.0)

| Archivo | Tipo | Cambios |
|---|---|---|
| `js/analytics.js` | **Modificado** | Nueva versión v11.0. Funciones añadidas: `_isLocalhost()`, `_isBot()` + `_BOT_UA_PATTERNS`, `_getNickname()`, `_unlockHumanGate()`, `_flushPendingQueue()`, `_startNicknamePoller()`, `_humanGateInit()` IIFE. Variables añadidas: `_humanGateUnlocked`, `_pendingQueue`, `_nicknamePoller`, `_STATE_KEY`. Funciones modificadas: `track()` (Doble Candado + inyección de nickname), `test()` (bloqueo en localhost/bot + nickname en payload), `status()` (muestra estado completo del Doble Candado), `_send()` (footer actualizado a v11.0). Mensaje de carga actualizado para indicar estado del Human Gate. |
| `js/app.js` | **Modificado** | Header actualizado: título con referencia a Ghost Analytics v11.0, nueva sección de compatibilidad en §NOVEDADES v9.9 documentando el contrato de integración con `track()` v11.0 (no pasar 'usuario', no disparar en carga automática). Sin cambios funcionales. |
| `DOCUMENTACION.md` | **Modificado** | Sección §2z añadida (este documento). ToC actualizado. Header de versión actualizado. |

---

## 2aa. Novedades en v11.1 — Word Hunt: Métricas de Progresión

**Objetivo:** Detectar automáticamente cuando un usuario se aproxima al límite de contenido disponible en el juego Word Hunt (Sopa de Letras) y enviar una alerta al canal de Discord para que el equipo pueda añadir nuevos niveles antes de que el jugador se quede sin partidas.

---

### Contexto del problema

Word Hunt cuenta actualmente con **150 niveles** definidos en `games/word-hunt/config_levels.js`. Un usuario que juegue con frecuencia puede agotar ese contenido. Sin un sistema de monitoreo, el equipo no sabría que un jugador está próximo al límite hasta que el juego simplemente no ofrezca más niveles.

---

### Fuentes de datos

| Variable | Descripción |
|---|---|
| `window.LA_WS_LEVELS` | Array global con todos los niveles cargados. `.length` = total disponible. |
| `la_ws_state.currentLevelIndex` | Índice (base 0) del nivel activo. `-1` si no hay ninguno en curso. |
| `la_ws_state.completedLevels` | `Set` con los IDs de niveles completados. Usado como fallback en la carga inicial. |
| `localStorage['la_ws_completedLevels']` | Fuente persistente del progreso del usuario (leída en `la_ws_loadProgress()`). |

---

### Lógica de alerta

```javascript
// Umbral: 90 % de niveles completados activa la alerta
const LA_WS_ALERT_THRESHOLD = 0.9;

// nivelReal = índice base-0 + 1
const nivelReal        = indiceActual + 1;
const nivelesRestantes = totalNiveles - nivelReal;

if (nivelReal >= totalNiveles * LA_WS_ALERT_THRESHOLD) {
    // → Disparar wordsearch_content_alert
}
```

**Clasificación de severidad:**

| Niveles restantes | `status` |
|---|---|
| ≤ 5 | `critical_low_content` |
| 6 – 15 | `warning_low_content` |
| 16+ (pero ≥ 90 %) | `approaching_limit` |

---

### Anti-spam: sessionStorage

Para no saturar el canal de Discord, `la_ws_checkProgressAlert()` solo re-dispara el evento cuando el número de niveles restantes **desciende** respecto al último valor reportado en la sesión.

```
sessionStorage['la_ws_alert_last_remaining'] = nivelesRestantes
```

- Si el usuario completa niveles 136, 137, 138 en la misma sesión → se envían **3 alertas** separadas (136 restantes=14, 137 restantes=13, 138 restantes=12).
- Si el usuario recarga la página sin completar nuevos niveles → **no se re-envía** (el valor en sessionStorage ya registra el mínimo).
- Al cerrar la pestaña, sessionStorage se limpia → la próxima sesión iniciará el conteo desde cero si el usuario sigue en zona de alerta.

---

### Payload del evento Discord

```json
{
  "event": "wordsearch_content_alert",
  "usuario": "NombreJugador",
  "nivel_actual_id": "lvl_136",
  "indice_actual": 135,
  "total_niveles": 150,
  "niveles_restantes": 14,
  "porcentaje_completado": "90.7%",
  "status": "warning_low_content"
}
```

El campo `usuario` es inyectado automáticamente por `GhostAnalytics.track()`, igual que en todos los demás eventos del HUB.

---

### Puntos de intercepción (Hooks)

| Hook | Ubicación en `game.js` | Momento |
|---|---|---|
| **Hook 1** | `la_ws_loadProgress()` | Al iniciar el juego — lee `completedLevels.size` como estimación del progreso cuando `currentLevelIndex` aún es `-1`. |
| **Hook 2** | `la_ws_completeLevel()` | Justo después de mostrar el modal de victoria — usa `currentLevelIndex` del nivel recién terminado. |
| **Hook 3** | `la_ws_showScreen('game')` | Al activar la pantalla de juego — captura también navigaciones directas a un nivel (p. ej. desde el botón Continuar). |

Los tres hooks llaman a la misma función `la_ws_checkProgressAlert()`. La deduplicación via sessionStorage garantiza que si los tres se disparan en secuencia corta (como ocurre al iniciar un nivel), solo se envíe **un aviso** mientras los restantes no cambien.

---

### Integración con Ghost Analytics

El evento `wordsearch_content_alert` pasa por el **Doble Candado** de GhostAnalytics igual que cualquier otro evento:

1. Shadow-Gate activo → descartado silenciosamente.
2. Localhost → descartado silenciosamente.
3. Bot UA → descartado.
4. Human Gate cerrado → encolado en `_pendingQueue`.
5. Sin nickname → encolado hasta que el poller lo detecte.
6. Rate limit (3 s) → descartado si se dispara el mismo payload dos veces seguidas.
7. ✅ Enviado a Discord con `usuario` inyectado.

El evento aparece registrado en `EVENT_COLORS` (ámbar `0xff9500`) y `EVENT_EMOJIS` (`📉`) para una identificación visual inmediata en el canal.

---

### Diagnóstico desde DevTools

```javascript
// Simular que el jugador está en el nivel 140 de 150 y comprobar la alerta:
window.GhostAnalytics.debug(true);   // activar logs detallados

// Ver si el evento se enviaría en el estado actual:
// (la función es interna al IIFE del juego, pero el efecto es visible en consola
//  bajo la etiqueta "[WordSearch] 📉 Alerta de progresión disparada")

// Limpiar el flag de sesión para re-probar sin recargar:
sessionStorage.removeItem('la_ws_alert_last_remaining');
```

---

### Resumen de cambios por archivo (v11.1)

| Archivo | Tipo | Cambios |
|---|---|---|
| `games/word-hunt/game.js` | **Modificado** | Versión bumped a v2.1. Nuevas constantes: `LA_WS_ALERT_THRESHOLD`, `LA_WS_ALERT_SESSION_KEY`. Nueva función: `la_ws_checkProgressAlert()`. Hooks añadidos en `la_ws_loadProgress()`, `la_ws_completeLevel()` y `la_ws_showScreen()`. |
| `js/analytics.js` | **Modificado** | Versión bumped a v11.1. Nuevo evento `wordsearch_content_alert` añadido a `EVENT_COLORS` (ámbar `0xff9500`) y `EVENT_EMOJIS` (`📉`). Footer del embed actualizado a v11.1. Mensajes de consola de carga actualizados. |
| `DOCUMENTACION.md` | **Modificado** | Sección §2aa añadida (este bloque). ToC actualizado. Header de versión actualizado a v11.1. |

---

## 2ab. Novedades en v12.0 — Infraestructura de Telemetría Segura (Telegram Proxy)

### Contexto y motivación

Hasta v11.1, Ghost Analytics enviaba los eventos directamente a un Webhook de Discord desde el navegador. El token del Webhook, aunque ofuscado con XOR en el array `_r`, era recuperable desde DevTools. Adicionalmente, el frontend construía los embeds completos, mezclando la lógica de presentación con la de captura.

v12.0 resuelve ambos problemas mediante una **Función Serverless en Vercel** que actúa como proxy hacia la API de Telegram.

---

### Nuevos archivos

| Archivo | Tipo | Descripción |
|---|---|---|
| `api/report.js` | **Nuevo** | Proxy Serverless. Único punto de contacto con la API de Telegram. Gestiona seguridad de origen, sanitización, clasificación en Topics y formateo HTML. |
| `js/analytics.js` | **Modificado** | Versión bumped a v12.0. Eliminado el array XOR `_r` y `_endpoint()`. Nuevo `_PROXY_ENDPOINT`, `_EVENT_TYPE_MAP` y `_resolveEventType()`. `_send()` refactorizado para el nuevo contrato de datos. |
| `.env` | **Nuevo** | Variables de entorno para desarrollo local (ignorado en Git). |
| `DOCUMENTACION.md` | **Modificado** | Sección §2ab añadida. ToC y header actualizados a v12.0. |

---

### Arquitectura del nuevo flujo

```
Navegador (js/analytics.js)
        │
        │  POST /api/report
        │  { type, user, event, data }
        ▼
Vercel Serverless (api/report.js)
        │  Validación de método + origen
        │  Sanitización de nickname
        │  Construcción del mensaje HTML
        │  Resolución del Topic (thread_id)
        │
        │  POST api.telegram.org/bot{TOKEN}/sendMessage
        ▼
Telegram (Topic correcto del grupo)
```

---

### Backend — `api/report.js`

#### Gestión de hilos (Topics)

| Tipo de evento  | `message_thread_id` | Emoji | Topic          |
|---|---|---|---|
| `analytics`   | `2` | 📈 | Analíticas |
| `achievement` | `3` | 🏆 | Logros     |
| `bug`         | `4` | 🚨 Bugs       |

#### Validación de método
Cualquier petición que no sea `POST` recibe `HTTP 405 Method Not Allowed`. Esto previene que crawlers indexen el endpoint.

#### Seguridad de origen
El header `origin` (o `referer` como fallback) debe contener el valor de `process.env.PRODUCTION_DOMAIN`. Las peticiones de orígenes no autorizados reciben `HTTP 403 Forbidden`. Si `PRODUCTION_DOMAIN` no está definido, la validación se omite para compatibilidad con las preview deployments de Vercel.

#### Sanitización contra inyecciones HTML
El nickname y los valores de `data` pasan por la función interna `sanitize()`, que escapa `& < > " '` antes de insertarlos en el mensaje HTML de Telegram. Esto previene que un nickname malicioso como `<b>hack</b>` altere el formato del mensaje.

#### Construcción del mensaje (modo HTML)
El mensaje se formatea con etiquetas `<b>`, `<i>` y `<code>` soportadas por la API de Telegram:

```
📈 OPEN GAME

👤 Usuario: Solecito
📌 Tipo:    analytics

📋 Datos:
  juego: puzzle-15

🕐 Servidor: 2025-11-03T14:22:01.004Z
Love Arcade · Ghost Analytics v12.0
```

Un **timestamp de servidor** se inyecta automáticamente en cada mensaje, independiente del timestamp del cliente. Permite detectar eventos retardados por la cola del Human Gate.

#### Error handling silencioso
Si la API de Telegram devuelve un error (rate limit, Topic eliminado, bot baneado…), la función serverless:
1. Loguea el error en la consola de Vercel (visible en el dashboard de logs).
2. Devuelve `HTTP 500` al frontend con un cuerpo genérico (`{ error: "Upstream error" }`).
3. El frontend registra el warning en consola pero **no interrumpe el juego**.

#### Variables de entorno

| Variable              | Descripción |
|---|---|
| `TELEGRAM_BOT_TOKEN`  | Token del bot obtenido vía @BotFather. Nunca expuesto al cliente. |
| `TELEGRAM_CHAT_ID`    | ID del grupo/canal destino (negativo para grupos supergrupo). |
| `PRODUCTION_DOMAIN`   | Dominio de producción (ej: `love-arcade.vercel.app`). Usado para validar el origen. |

---

### Frontend — `js/analytics.js` (v12.0)

#### Eliminaciones
- **Array `_r`**: la ofuscación XOR del Webhook de Discord ha sido eliminada por completa. Ya no hay credenciales en el bundle del cliente.
- **Función `_endpoint()`**: reemplazada por la constante `_PROXY_ENDPOINT = '/api/report'`.
- **`EVENT_COLORS`**: los colores de embed de Discord ya no son necesarios. El formateo visual es responsabilidad del proxy.

#### Nuevo contrato de datos (Payload ligero)

```json
{
  "type":  "analytics | bug | achievement",
  "user":  "Solecito",
  "event": "open_game",
  "data":  { "juego": "puzzle-15" }
}
```

El campo `user` es inyectado automáticamente por `_send()` — nunca debe pasarse en el objeto `meta` de `track()`.

#### Clasificación de eventos (`_EVENT_TYPE_MAP`)

| Evento                      | Tipo           | Topic destino |
|---|---|---|
| `detected_error`            | `bug`          | 🚨 Bugs       |
| `invalid_promo_code`        | `bug`          | 🚨 Bugs       |
| `wordsearch_content_alert`  | `bug`          | 🚨 Bugs       |
| `buy_item`                  | `achievement`  | 🏆 Logros     |
| `redeem_code`               | `achievement`  | 🏆 Logros     |
| `daily_bonus`               | `achievement`  | 🏆 Logros     |
| `view_preview`              | `analytics`    | 📈 Analíticas |
| `click_download`            | `analytics`    | 📈 Analíticas |
| `open_game`                 | `analytics`    | 📈 Analíticas |
| `insufficient_funds`        | `analytics`    | 📈 Analíticas |
| `user_snapshot`             | `analytics`    | 📈 Analíticas |
| `sync_export`               | `analytics`    | 📈 Analíticas |

Los eventos no listados en `_EVENT_TYPE_MAP` caen en `"analytics"` por defecto.

#### Sin cambios en la lógica de seguridad
El Doble Candado (Shadow-Gate + Anti-Localhost + Anti-Bot + Human Gate), el Nickname Poller y la `_pendingQueue` se mantienen **exactamente igual**. Solo la capa de transporte ha cambiado.

---

### Configuración de Vercel

#### Variables de entorno en producción
Desde el dashboard de Vercel → **Settings → Environment Variables**:

```
TELEGRAM_BOT_TOKEN   = 123456789:ABCdef...
TELEGRAM_CHAT_ID     = -1001234567890
PRODUCTION_DOMAIN    = love-arcade.vercel.app
```

#### Archivo `.env` para desarrollo local

```bash
# .env  (en la raíz del proyecto — añadir a .gitignore)
TELEGRAM_BOT_TOKEN=123456789:ABCdef...
TELEGRAM_CHAT_ID=-1001234567890
PRODUCTION_DOMAIN=love-arcade.vercel.app
```

> **Importante:** aunque el proxy está desplegado, `js/analytics.js` aborta en localhost por el Anti-Localhost (Candado 1A). Las funciones serverless sí pueden probarse localmente con `vercel dev`, pero el frontend no les enviará eventos.

---

### Diagnóstico desde DevTools

```javascript
// Verificar estado del módulo (incluye la ruta del Proxy):
window.GhostAnalytics.status()

// Enviar evento de prueba al Proxy (aparece en el Topic de Analíticas):
window.GhostAnalytics.test()

// Activar logs detallados:
window.GhostAnalytics.debug(true)
// → Cada fetch muestra el payload exacto enviado al proxy
```

---

### Resumen de cambios por archivo (v12.0)

| Archivo | Tipo | Cambios clave |
|---|---|---|
| `api/report.js` | **Nuevo** | Función serverless completa. Validación de método, seguridad de origen, mapeo de Topics, sanitización HTML, construcción del mensaje, envío a Telegram, error handling silencioso. |
| `js/analytics.js` | **Modificado** | v12.0. Eliminados `_r`, `_endpoint()`, `EVENT_COLORS`. Añadidos `_PROXY_ENDPOINT`, `_EVENT_TYPE_MAP`, `_resolveEventType()`. `_send()` refactorizado para payload `{ type, user, event, data }`. `test()` actualizado. Mensajes de consola actualizados. |
| `DOCUMENTACION.md` | **Modificado** | Sección §2ab añadida. ToC actualizado. Header actualizado a v12.0. |

---

## 2ac. Novedades en v12.1 — Body Parser Hardening (Bugfix)

### Problema

Tras el despliegue de v12.0, los mensajes de Telegram mostraban valores por defecto (`UNKNOWN`, `desconocido`, `Sin metadatos adicionales`) en lugar de los datos reales del evento.

**Causa raíz:** `req.body` llegaba como `undefined` en determinados escenarios del runtime de Vercel. El campo `type`, `user`, `event` y `data` no se podían desestructurar, por lo que caían en sus valores de fallback.

Los escenarios que reproducen el problema son:

| Escenario | Estado de `req.body` |
|---|---|
| Función en **cold start** | `undefined` |
| Request con `keepalive: true` (fetch del frontend) | `undefined` o `Buffer` |
| `Content-Type` no reconocido por el runtime | `string` crudo |
| Body parser declarado implícitamente (v12.0) | Comportamiento no garantizado entre entornos |

El frontend (`js/analytics.js`) enviaba el payload correctamente con `Content-Type: application/json`. El error era **exclusivamente del lado del servidor**.

---

### Solución

Dos cambios quirúrgicos en `api/report.js`, sin afectar el resto de la lógica:

#### 1. Declaración explícita del body parser (`export const config`)

```javascript
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '16kb',
        },
    },
};
```

Fuerza a Vercel a activar el parser JSON en **todos** los entornos: producción, preview deployments y `vercel dev`. Sin esta declaración, Vercel aplica un valor por defecto que no garantiza el estado de `req.body` en todos los escenarios de runtime.

El límite de `16kb` es suficiente para cualquier payload de analíticas y previene abusos con bodies gigantes.

#### 2. Helper defensivo `_parseBody(req)`

Actúa como red de seguridad independientemente de `export const config`, cubriendo los cuatro estados posibles de `req.body`:

| Caso | Estado de `req.body` | Acción del helper |
|---|---|---|
| **A** | Objeto plano (parseado por Vercel) | Se usa directamente — camino nominal |
| **B** | `string` | `JSON.parse()` directo |
| **C** | `Buffer` | `.toString('utf8')` + `JSON.parse()` |
| **D** | `undefined` | Lectura del raw stream con `req.on('data')` |

En cualquier fallo de parseo (JSON malformado, stream vacío) el helper devuelve `{}` para que los defaults del destructuring entren en juego de forma controlada.

```javascript
// En el handler — sustitución de la línea anterior:
//   const { type, user, event, data } = req.body || {};
//
// Por la nueva llamada defensiva:
const body = await _parseBody(req);
const { type = 'analytics', user = 'desconocido', event = 'unknown', data = {} } = body;
```

---

### Sin cambios en el frontend

`js/analytics.js` no requería modificaciones. La función `_send()` ya enviaba el payload correcto:

```javascript
fetch(_PROXY_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ type, user, event, data }),
    keepalive: true,
});
```

El problema era exclusivamente la recepción del body en el servidor.

---

### Diagnóstico para verificar el fix

Tras el despliegue de v12.1, ejecutar desde DevTools en producción:

```javascript
window.GhostAnalytics.test()
```

El mensaje en el Topic de Analíticas debe mostrar:
- **Usuario:** el nickname real (no `desconocido`)
- **Evento:** `GHOST TEST [TEST]` (no `UNKNOWN`)
- **Datos:** `fuente: GhostAnalytics.test()` (no `Sin metadatos adicionales`)

Si los valores siguen siendo los defaults, revisar los logs de la función serverless en Vercel → **Deployments → Functions → report** para confirmar que la nueva versión está desplegada.

---

### Resumen de cambios por archivo (v12.1)

| Archivo | Tipo | Cambios clave |
|---|---|---|
| `api/report.js` | **Modificado** | v12.1. Añadido `export const config` con `bodyParser: { sizeLimit: '16kb' }`. Nuevo helper privado `_parseBody(req)` con cobertura de los cuatro estados posibles de `req.body`. Sustitución de `req.body \|\| {}` por `await _parseBody(req)` en el paso 5. Footer del mensaje de Telegram actualizado a v12.1. |
| `DOCUMENTACION.md` | **Modificado** | Sección §2ac añadida. ToC actualizado. Header actualizado a v12.1. |

## 2ad. Novedades en v13.0 — Sentinel Cloud Sync (Supabase)

### Visión General

La v13.0 introduce la **capa de persistencia en la nube** de Love Arcade mediante el **Patrón Sentinel (Observador)**. El progreso del usuario ahora es **portable entre dispositivos** sin modificar el código de ningún minijuego.

---

### Arquitectura — El Patrón "Sentinel"

```
┌──────────────────────────────────────────────────────────────────────┐
│  DOMINIO COMPARTIDO (mismo origen — todos los juegos)                │
│                                                                      │
│  Word Hunt ─┐                                                        │
│  Rompecabez ─┤  localStorage.setItem() ──► StorageInterceptor       │
│  2048 Lumina ─┤  (claves vigiladas)          (en js/app.js)          │
│  Space Shoot ─┤                                     │                │
│  Ollin Smash ─┤                               debounce 12 s          │
│  Jungle Dash ─┤                                     │                │
│  Dodger ─────┘                               _sentinelSync()         │
│                                                     │                │
│  gamecenter_v6_promos (Hub) ─────────────────►  Supabase            │
│                                                  (JSONB upsert)      │
└──────────────────────────────────────────────────────────────────────┘
```

El Sentinel vive **exclusivamente en `js/app.js`** como una IIFE (`SentinelCloudSync`). Dado que todos los minijuegos corren bajo el mismo dominio (subcarpetas), comparten el localStorage del Hub. El Sentinel intercepta `localStorage.setItem`, detecta escrituras a claves críticas y orquesta la subida a Supabase sin que ningún juego lo sepa.

---

### Mapa de Claves Vigiladas

| Juego | Claves sincronizadas |
|---|---|
| Hub Principal | `gamecenter_v6_promos` |
| Word Hunt | `la_ws_completedLevels`, `la_ws_state` |
| Rompecabezas | `puz_arcade_progress`, `puz_arcade_unlocked` |
| 2048 Lumina | `LUMINA_bestScore`, `LUMINA_gameState` |
| Space Shooter | `la_shooter_highscore`, `la_shooter_settings` |
| Ollin Smash | `OS_highscore` |
| Jungle Dash | `JD_highscore`, `JD_muted` |
| Dodger | `dodger_highscore`, `dodger_skin`, `dodger_muted` |

---

### Infraestructura — Supabase

#### Variables de entorno (Vercel Dashboard → Settings → Environment Variables)

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_LA_CLOUD_URL` | URL del proyecto en Supabase (ej: `https://abc.supabase.co`) |
| `NEXT_PUBLIC_LA_CLOUD_ANON_KEY` | Llave API pública (Anon). Segura en cliente gracias a RLS. |

> **Nota de seguridad:** El Anon Key de Supabase está diseñado para ser público. La seguridad real la provee la política de Row Level Security (RLS) de la base de datos, que garantiza que cada usuario solo pueda leer y escribir su propio perfil.

#### Esquema SQL — ejecutar UNA VEZ en el editor de Supabase

```sql
-- Tabla de perfiles de usuario con JSONB para el snapshot de progreso
CREATE TABLE user_profiles (
  id          UUID REFERENCES auth.users PRIMARY KEY,
  game_data   JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security: cada usuario solo accede a su propio registro
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "own_insert" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "own_update" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
```

---

### Flujo de Autenticación — Magic Link

1. El usuario navega a **Tienda → Sincronizar → Sincronización en la Nube**.
2. Ingresa su correo y pulsa **Enviar Magic Link**.
3. Supabase envía un email con el enlace de autenticación.
4. El usuario hace clic en el enlace → el navegador redirige al hub con el token en el URL hash.
5. `onAuthStateChange` detecta el evento `SIGNED_IN`.
6. El Sentinel ejecuta `_sentinelLoad()`: descarga el perfil y aplica **Last Write Wins**.

```
Usuario → escribe email → btn-cloud-login
    → supabase.auth.signInWithOtp({ email })
        → email enviado
            → usuario hace clic en enlace
                → onAuthStateChange('SIGNED_IN')
                    → _sentinelLoad()
                        → comparar updated_at (nube vs local)
                            → aplicar el más reciente
```

---

### Resolución de Conflictos — Last Write Wins (LWW)

La estrategia **Last Write Wins** se basa en el campo `updated_at` de la tabla `user_profiles`:

| Escenario | Acción |
|---|---|
| Perfil en nube no existe | Subir snapshot local inmediatamente |
| `updated_at` nube > timestamp local | Aplicar snapshot de nube al localStorage |
| Timestamp local ≥ `updated_at` nube | Subir snapshot local a la nube |

El timestamp local se almacena en la clave `love_arcade_sentinel_ts` (separada del store principal para no contaminar checksums de exportación).

---

### StorageInterceptor — Debounce Sync

```javascript
// El setItem original se preserva para uso interno del Sentinel
const _originalSetItem = localStorage.setItem.bind(localStorage);

// Interceptor instalado globalmente
localStorage.setItem = function(key, value) {
    _originalSetItem(key, value);                    // siempre escribe
    if (SENTINEL_WATCHED_KEYS.has(key) && _sbSession) {
        _sentinelScheduleSync();                     // dispara debounce
    }
};
```

**Debounce de 12 segundos:** tras la última escritura a una clave vigilada, el Sentinel espera 12 s de inactividad antes de subir. Esto agrupa múltiples cambios rápidos (ej: partida rápida con varias escrituras) en una sola llamada a Supabase.

**Claves no vigiladas** (ej: `love_arcade_time_cache`, `love_arcade_last_recipient`) pasan por el interceptor sin disparar sync, preservando la eficiencia.

---

### Endpoint Serverless — `api/client-config.js`

```
GET /api/client-config
→ { supabaseUrl: string, supabaseKey: string }
```

Funciona como proxy seguro para las variables de entorno. El cliente nunca las ve en el código fuente del repositorio. Si las variables no están configuradas, devuelve strings vacíos y el Sentinel se desactiva en modo degradado.

**Cache-Control:** `no-store` para evitar que el CDN de Vercel cachee credenciales.

---

### Evento Personalizado — `la:cloudsynced`

Cuando el Sentinel aplica un snapshot de la nube al localStorage, dispara:

```javascript
document.dispatchEvent(new CustomEvent('la:cloudsynced', {
  detail: { source: 'cloud' }
}));
```

Los módulos que necesiten reaccionar a una restauración de progreso (ej: `shop-logic.js`) pueden escuchar este evento sin acoplamiento directo con el Sentinel.

---

### API de Diagnóstico

Disponible en DevTools (`Console`) tras la inicialización:

```javascript
window.Sentinel.getStatus()
// → { hasClient: true, hasSession: true }

window.Sentinel.syncNow()
// Fuerza sincronización inmediata ignorando el debounce

window.Sentinel.getSession()
// → objeto de sesión de Supabase (user.id, user.email, etc.)
```

---

### Resumen de Cambios por Archivo (v13.0)

| Archivo | Tipo | Cambios clave |
|---|---|---|
| `index.html` | **Modificado** | CDN de `@supabase/supabase-js@2` en `<head>`. Card "Sincronización en la Nube" en `#tab-sync`. Panel de login (email + Magic Link) y panel de sesión (estado, sync manual, cerrar sesión). Comentario de orden de scripts actualizado. |
| `js/app.js` | **Modificado** | IIFE `SentinelCloudSync` añadida al final. Incluye: `SENTINEL_WATCHED_KEYS`, `StorageInterceptor`, `_buildSnapshot()`, `_applySnapshot()`, `_sentinelSync()`, `_sentinelLoad()`, `_sentinelScheduleSync()`, `_handleSignIn()`, `_handleSignOut()`, listeners de UI, `_sentinelInit()`, `window.Sentinel` API pública. |
| `api/client-config.js` | **Nuevo** | Función serverless Vercel. Expone `NEXT_PUBLIC_LA_CLOUD_URL` y `NEXT_PUBLIC_LA_CLOUD_ANON_KEY` al cliente. Cache-Control: no-store. Bodyparser desactivado (GET-only). |
| `vercel.json` | **Modificado** | Header `Content-Type: application/json` y `Cache-Control: no-store` para rutas `/api/*`. Sin cambios en rewrites (la regla `/api/(.*)` existente cubre el nuevo endpoint). |
| `DOCUMENTACION.md` | **Modificado** | Sección §2ad añadida. ToC actualizado. Header actualizado a v13.0. |

---

*Love Arcade · Documentación técnica v13.0 + Ghost Analytics v12.1 (Sentinel Cloud Sync · Body Parser Hardening · Telegram Proxy · Doble Candado · Word Hunt Progression Metrics)*

---

## 2ae. Novedades en v14.0 — Gatekeeper Security & UX Refactor

La v14.0 mueve el acceso cloud desde la zona de tienda a un **flujo de entrada automático** y endurece la seguridad de credenciales con una política de contraseña de nivel consola.

### Cambios clave

| Área | Cambio |
|---|---|
| **Entrada automática** | Al cargar (`DOMContentLoaded`), si no hay sesión cloud y no hay identidad local, se abre automáticamente el **Modal de Acceso Unificado** y se bloquea el acceso hasta elegir registro/login o entrar como invitad@. |
| **Modo Invitado** | Eliminado en v14.2. El acceso requiere sesión Supabase válida. |
| **Dashboard en Tienda** | La tarjeta de nube pasa a ser un panel de cuenta: estado (`En línea` / `Invitado`), última sincronización (`updated_at`) y acciones de gestión (`Cambiar Contraseña`, `Cerrar Sesión`). |
| **Contraseñas reforzadas** | Registro y cambio de contraseña exigen: mínimo 20 caracteres, mayúscula, minúscula, dígito y símbolo (`@$!%*?&`). |
| **Validación en vivo** | Reglas visuales bajo el input cambian de rojo a verde en tiempo real y bloquean submit hasta cumplir el 100% de requisitos. |
| **Sentinel v14** | El `upsert` mantiene el esquema de `user_profiles` y ahora persiste `id`, `game_data`, `nickname`, y `updated_at` para alimentar dashboard y trigger metadata-flow. |
| **Consistencia multi-dispositivo** | `SentinelCloudSync` aplica estrategia **Last Write Wins** comparando `updated_at` cloud vs marca local (`SENTINEL_TS_KEY`), evitando sobreescritura con snapshots antiguos. |
| **Persistencia rápida** | Debounce de sync reducido a 1 s + sincronización inmediata en operaciones críticas de monedas (`completeLevel`, `addCoins`, `buyItem`, `spendCoins`). |
| **Reintento asíncrono de sesión** | Si una escritura crítica ocurre antes de restaurar sesión Supabase en una pestaña de juego, se programa reintento diferido de sync inmediato (500 ms, hasta 3 intentos) para evitar pérdidas silenciosas. |
| **Bridge cross-tab (`storage`)** | El Hub escucha el evento global `storage`: cuando otra pestaña (juego) modifica una clave vigilada y hay sesión activa, el Sentinel programa sync con debounce de 1 s. |
| **Memoria del Hub en caliente** | Ante cambios cross-tab se rehidrata el `store` en memoria desde `localStorage` para que HUD/saldo no queden desactualizados hasta la próxima interacción. |
| **Marca de tiempo local robusta** | Cambios detectados por `storage` actualizan `love_arcade_sentinel_ts` local, evitando falsos empates de timestamp contra nube en recargas posteriores. |
| **Navegador en segundo plano** | Si la pestaña está oculta, el scheduler evita depender de `setTimeout` throttled y fuerza sync en `visibilitychange/pagehide` cuando hay cambios pendientes. |
| **Sentinel v14.5 (prioridades)** | Claves críticas (monedas/progreso/configuración) sincronizan en ~1 s; claves pasivas (playtime/estado incremental) usan ventana de 60 s o flush al salir/minimizar. |

### Contrato Supabase respetado (v14)

```sql
public.user_profiles (
  id uuid primary key,
  updated_at timestamptz,
  game_data jsonb,
  nickname text
)
```

### Flujo de autenticación actualizado

1. `DOMContentLoaded` evalúa identidad local y sesión cloud.
2. Si falta ambas, se abre Gatekeeper en modo bloqueado.
3. Solo `Login` habilita sesión cloud para usuarios ya provisionados por administración en Supabase.
4. Si no hay sesión activa, el middleware de acceso mantiene el gatekeeper bloqueado.
5. Sentinel sincroniza con debounce de 1 s y actualiza `updated_at` para dashboard.
*Arquitectura: vanilla JS + Vercel Serverless + Supabase (Auth + PostgreSQL JSONB) · Compatible con GitHub Pages (frontend) + Vercel (proxy + serverless)*

## 2af. Novedades en v14.1 — Gestión robusta de cuota localStorage y avatares

Esta versión endurece la persistencia local para evitar `QuotaExceededError` y proteger el progreso del jugador cuando el almacenamiento del navegador está cerca del límite (5–10 MB según navegador/dispositivo).

### Cambios clave

### Registro de mantenimiento

- **Fecha:** 2026-05-15  
  **Cambio:** Se eliminó del Gatekeeper el registro (`signUp`) y el acceso "Continuar como invitado"; el modal quedó centrado únicamente en `Iniciar sesión` con Supabase.  
  **Razón técnica:** *Control administrativo estricto de usuarios desde Supabase y simplificación del flujo de autenticación*.

- **Fecha:** 2026-05-15  
  **Cambio:** Se retiraron de la interfaz de "Sincronización en la Nube" las acciones de `Cambiar Contraseña`, `Cambiar Correo` y `Cerrar Sesión`, junto con su lógica cliente asociada.  
  **Razón técnica:** *Gestión de credenciales delegada nativamente a Supabase para simplificar la lógica del cliente*.

| Área | Cambio |
|---|---|
| **Avatares** | `GameCenter.setAvatar()` ahora es asíncrona. Comprime imágenes con canvas (`200x200`, calidad `0.7`) antes de guardar/subir. |
| **Cloud Avatar (Supabase Storage)** | Si existe sesión cloud (`Sentinel.getSession()`), se valida sesión fresca (`sbClient.auth.getSession()`) y el avatar se sube al bucket `avatars` en `{userId}/profile.jpg` (ruta relativa al bucket, upsert). Se guarda URL pública en `store.userAvatar`. |
| **Fallback local seguro** | Si no hay sesión cloud o falla la subida, el avatar se guarda como Base64 comprimido solo si queda por debajo de `100 KB`. Si supera ese límite, se rechaza con mensaje de error controlado. |
| **Limpieza de avatar legado** | En INIT síncrono, si detecta avatar Base64 > `200 KB`, se elimina automáticamente y se registra `GhostAnalytics.track('storage_cleaned', { reason: 'avatar_too_large' })`. |
| **Historial** | `logTransaction()` reduce retención: de 150 → 50 entradas. |
| **Migración de estado** | `migrateState()` elimina `redeemedCodes` y limpia `userAvatar` legado en DataURL para evitar payloads grandes persistidos. |
| **Progreso por juego** | Nuevo `trimGameProgress()` limita cada arreglo `store.progress[gameId]` a las últimas 50 entradas. |
| **Limpieza de emergencia** | Nuevo `emergencyCleanup()` ejecutado al detectar cuota excedida: limpia avatar grande, recorta historial, elimina legado y trimea progreso. Si el store sigue >4 MB, vacía historial. |
| **Guardado resiliente** | `saveState()` maneja `QuotaExceededError` con reintento tras cleanup. Si falla de nuevo, muestra toast de error y evita freeze del flujo. |
| **Monitoreo de tamaño** | Nuevo `checkStorageSize()` registra `storage_warning` cuando el store supera 4000 KB y muestra recomendación al usuario para exportar partida. |
| **Toasts de warning** | Se añade soporte visual para `toast--warning` en `shop-logic.js` y `styles.css`. |
| **Analytics** | `analytics.js` incorpora eventos `storage_cleaned` (🧹) y `storage_warning` (⚠️), ambos clasificados como tipo `bug`. |

### Requisito manual en Supabase (importante)

Para que la subida de avatares cloud funcione en producción:

1. Crear bucket público `avatars`.
2. Configurar políticas RLS de lectura pública y escritura restringida por `auth.uid()`.
3. Mantener la convención de ruta `{userId}/profile.jpg` (objeto relativo al bucket) para que `storage.foldername(name))[1]` sea el UID y cumpla RLS.

> Nota: este paso se configura en Supabase Dashboard / SQL Editor y no se automatiza desde frontend.

### Nota de arquitectura (avatar y game_data)

- `userAvatar` **no debe viajar** dentro de `game_data` en cloud sync.
- El binario/archivo vive en Supabase Storage (`avatars`) y sólo se persiste la URL pública en `user_profiles.avatar_url`.

---

## 2ag. Novedades en v14.2 — Floating Pill Navigation

### Changelog

| Área | Cambio |
|---|---|
| **Navegación** | La navegación principal se unifica en un único `<nav class="pill-nav">` fijo y flotante para móvil, tablet y desktop. Sustituye por completo los enlaces superiores `.nav-links` y la antigua bottom nav. |
| **Estado activo** | Un único indicador `.pill-nav__indicator` se mueve bajo el ítem activo. El ítem seleccionado muestra icono y etiqueta; los demás conservan sus iconos y sus etiquetas permanecen disponibles en el DOM. |
| **Accesibilidad** | Los enlaces nativos mantienen nombre accesible, foco visible, objetivo mínimo de 44 × 44 px y `aria-current="page"` en la ruta activa. |
| **Rendimiento** | El indicador se reposiciona con una lectura puntual de layout por navegación o resize con debounce; `will-change` se activa solo durante el movimiento y se libera al terminar. |

### Arquitectura del componente

El componente se monta una sola vez en `index.html`. Su track contiene los tres enlaces raíz (`home`, `shop` y `profile`) y el indicador compartido. No existe una implementación paralela para desktop: el mismo componente baja de forma flotante en las tres plataformas.

```html
<nav class="pill-nav" aria-label="Navegación principal">
  <div class="pill-nav__track">
    <div class="pill-nav__indicator" aria-hidden="true"></div>
    <a class="pill-nav-item" data-view="home">…</a>
    <a class="pill-nav-item" data-view="shop">…</a>
    <a class="pill-nav-item" data-view="profile">…</a>
  </div>
</nav>
```

Cada etiqueta `.pill-nav-item__label` existe siempre. CSS la revela solo para el enlace activo con `clip-path`; no se elimina con `display: none`, de modo que el contenido y el nombre del enlace siguen disponibles para tecnologías asistenciales.

### Contrato con `spa-router.js`

`SpaRouter` conserva la única fuente de verdad de la vista: `currentView`, sincronizada con la History API. La pill nav es una proyección de ese estado, nunca un estado de navegación propio.

- **No cambiar ni eliminar `data-view`.** Cada enlace raíz debe conservar exactamente `home`, `shop` o `profile`; el router los usa para enlazar el clic con la vista y para actualizar el estado activo.
- **No modificar la API pública.** `window.SpaRouter.navigateTo(viewId, anchor, replace)` y `window.SpaRouter.getCurrentView()` son contratos consumibles por el resto de la aplicación.
- **No duplicar el estado activo.** `_syncNavHighlight(viewId)` aplica `.active` y `aria-current="page"`, y después actualiza el indicador. Los listeners se registran una vez al cargar el DOM.
- **Indicador medido de forma acotada.** `_syncPillNavIndicator()` lee las dimensiones del ítem activo una vez por cambio de vista; el `resize` se agrupa con un debounce de 120 ms. No deben añadirse mediciones en un bucle de animación.

### Tema, responsive y movimiento

La navegación no introduce colores propios. El track usa `--solid-surface-float` y `--border-subtle`; el indicador consume `--accent-soft`, `--accent-border`, `--accent-glow` y el texto activo usa `--text-on-accent-aa`. Estos tokens proceden del sistema `THEMES` de `js/app.js` y de su inicialización crítica, por lo que cualquier cambio de color debe reutilizar tokens existentes en vez de hardcodear valores.

El layout es mobile-first y usa `position: fixed` con `--pill-nav-bottom`, calculado a partir de `env(safe-area-inset-bottom)` y un offset. `body` reserva `--pill-nav-clearance` para que el contenido, los toasts y los controles de la vista no queden detrás de la píldora. En 640 px y 768 px solo aumentan las variables de ancho, inset, separación y offset: no se activa una segunda navegación de escritorio.

La animación se limita a `transform`, `opacity` y `clip-path`: el indicador usa una transición de 200 ms y el label se revela en 220 ms. Con `prefers-reduced-motion: reduce`, ambas transiciones se reducen a un cambio prácticamente instantáneo. No se debe animar tamaño, posición de layout, sombras o márgenes.

La píldora es una superficie sólida: no usa `backdrop-filter`. Esta política evita el coste de rasterización adicional en móviles y mantiene la regla de superficies Arcade Solid 3.0. El único `will-change` permitido es el temporal de `.pill-nav__indicator--moving`; se retira al recibir `transitionend` o al cumplirse la red de seguridad del router.

### Añadir una cuarta sección

Para incorporar una nueva ruta primaria, el cambio debe hacerse de forma coordinada:

1. Añadir el enlace `.pill-nav-item` con su `data-view` nuevo y su label en `index.html`.
2. Añadir el `<symbol>` SVG correspondiente al sprite de `index.html` y referenciarlo desde el nuevo enlace con `<use href="#icon-NOMBRE">`.
3. Añadir el nuevo id a `VIEWS` en `js/spa-router.js`.
4. Crear la sección de vista correspondiente con el id `view-NUEVO_ID` en `index.html` y conectar su ciclo de vida si la vista lo requiere.
5. Verificar navegación directa, History API, foco, `aria-current`, los cinco temas y el comportamiento en móvil, tablet y desktop.

No se debe crear una segunda barra de navegación ni gestionar manualmente `.active`: el router detectará el nuevo enlace por `.pill-nav-item[data-view]` y actualizará el indicador con la misma ruta de código.

### Resumen de cambios por archivo (v14.2)

| Archivo | Tipo | Cambios clave |
|---|---|---|
| `index.html` | Modificado | Único markup de la pill nav, sprite SVG y vistas que componen las rutas primarias. |
| `styles.css` | Modificado | Tokens de tamaño y safe area, estilo responsive de la píldora, reveal del label, foco visible y política de movimiento reducido/sin blur. |
| `js/spa-router.js` | Modificado | Sincronización visual y semántica de la pill nav, indicador compartido, medición puntual y liberación temporal de la capa GPU. |
| `sw.js` | Modificado | Cache-busting del app shell tras los cambios de navegación. |
| `README.md` | Modificado | Versión de producto actualizada para reflejar la navegación flotante. |
| `docs/DOCUMENTACION.md` | Modificado | Sección §2ag, índice, changelog, contrato de mantenimiento y resumen de archivos. |

---

## §2ah — Daily Streak Hub Redesign (Fire Widget)

### Motivación

El HUD de Inicio pasó de repartir la atención entre un saludo, un indicador de conectividad sin fuente de datos, un saldo repetido y el reclamo diario, a dar prioridad a la racha. La decisión de retirar esos elementos está documentada en la [auditoría §2.4 del rediseño](daily-streak-hub-redesign.md#24-elementos-redundantes-o-de-bajo-valor-detectados-hecho--inferencia): el saldo ya vive en la navbar, el indicador no representaba conectividad real y el saludo extenso competía con la jerarquía de juego. La fila de identidad conserva el avatar, `#display-nickname` y `#cloud-sync-indicator`, que sí tienen función vigente.

El resultado es un único botón nativo, `#btn-daily`, que contiene el fuego, el número de racha y el CTA. Se preservan los IDs consumidos por la lógica existente: `#hud-daily-label`, `#hud-daily-cta-text`, `#hud-reward-amount`, `#streak-days`, `#streak-count`, `#daily-countdown`, `#countdown-display` y `#daily-msg`.

### Arquitectura

`index.html` declara el SVG inline decorativo `#streak-flame`: tres paths independientes (`.flame-layer--back`, `.flame-layer--mid` y `.flame-layer--core`), el halo `.streak-flame__glow` y seis `.spark`. El estado de negocio no se duplica en el DOM: `js/streak-hub.js` lee `GameCenter.getStreakInfo()` y `GameCenter.canClaimDaily()` y escribe únicamente `data-state` en `#streak-flame`, además de actualizar `#streak-count-big` y el nombre accesible de `.streak-hub-number`.

`window.StreakHub.refresh()` no crea temporizadores y se invoca al cargar y desde los refrescos existentes del HUD. Tras un reclamo exitoso, `window.StreakHub.playClaimSequence(result)` fija el estado temporal, reproduce el audio sintético, y al cabo de 480 ms refresca el estado, aplica el bump del número y crea ocho monedas efímeras en `#streak-coin-burst`. El canal semántico del resultado sigue siendo `#daily-msg[role="status"][aria-live="polite"]`; tanto el fuego como las monedas están ocultos a tecnologías asistenciales.

### Tabla de estados

| Estado | Condición que lo asigna `StreakHub` | Mapeo en DOM | Resultado visual y de interacción |
|---|---|---|---|
| `locked` | `info.streak === 0` y el bono está disponible | `#streak-flame[data-state="locked"]` | Llama tenue y gris, sin chispas; el CTA sigue disponible para establecer la primera racha. |
| `available` | El bono se puede reclamar y no hay reparación pendiente | `#streak-flame[data-state="available"]` | Llama intensa, halo con mayor opacidad y seis chispas; `updateDailyButton()` mantiene el CTA de reclamo. |
| `repair` | `info.repairAvailable` | `#streak-flame[data-state="repair"]` | Tono ámbar, sin chispas; el botón usa modo `repair` y abre el flujo de reparación existente. |
| `claiming` | Reclamo exitoso durante la secuencia de 480 ms | `#streak-flame[data-state="claiming"]` | Pausa las capas y ejecuta `flameBurst`; no es un estado persistido. |
| `claimed` | El bono no está disponible y no aplica reparación | `#streak-flame[data-state="claimed"]` | Llama calmada y desaturada, sin chispas; el countdown comunica el siguiente bono. |

### Decisiones de rendimiento y accesibilidad

Se eligieron SVG inline y CSS nativo frente a Canvas o librerías de animación porque el widget tiene tres capas, seis partículas estáticas y estados discretos: no necesita un render loop, una dependencia nueva ni nodos de escena generados por JavaScript. Las animaciones recurrentes del fuego y las chispas usan `transform` y `opacity`; el blur del halo no se anima. En `pointer: coarse`, el blur baja a 10 px y `prefers-reduced-motion: reduce` detiene las animaciones del fuego, halo, chispas y burst, conservando los estados por color e intensidad estática.

El listener de visibilidad ya existente añade `.motion-paused` a `.player-hud` cuando la pestaña queda oculta. Las reglas de `styles.css` pausan las capas del fuego, halo y chispas con `animation-play-state: paused`; no se añadieron listeners ni timers de visibilidad específicos al módulo. El SVG decorativo usa `aria-hidden="true"`; el número publica la racha mediante `role="img"` y etiqueta dinámica, y `.streak-hub-cta:focus-visible` conserva un anillo de foco con `--focus-ring-aa`.

### Changelog — ambient estático del Player HUD (Ticket-07)

El antiguo `hudAmbientSweep` se retiró por completo. El halo animado seguía mostrando banding pese al blur y mantenía trabajo continuo de compositor en la pantalla con mayor tiempo de uso de la aplicación. Lo reemplaza el ambient estático del HUD: un degradado construido con los tokens de tema y una textura de ruido/dithering de baja opacidad. Al no tener movimiento, el halo ya no participa en las reglas de pausa por visibilidad ni en `prefers-reduced-motion`; estas conservan su alcance sobre el fuego, las chispas y el anillo de avatar que sí se animan.

### Corrección de celebración de hitos

**Changelog independiente — Ticket-08.** El listener de `#btn-daily` en `js/app.js` programa `showStreakMilestoneModal()` 600 ms después de un `GameCenter.claimDaily()` exitoso. Antes del arreglo, un hito alcanzado por ese reclamo se detectaba recién en una carga posterior. El retraso deja terminar el feedback de reclamo y la función conserva el candado `_streakMilestoneModalLocked` contra aperturas reentrantes.

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `index.html` | Estructura del hub, SVG del fuego, IDs preservados, contador y contenedor de monedas; carga `js/streak-hub.js`. |
| `styles.css` | Estados `data-state`, animaciones del fuego y reclamo, número, micro-progreso, reducción de movimiento y pausa por visibilidad. |
| `js/streak-hub.js` | Sincronización visual, secuencia de reclamo, audio Web Audio API, burst de monedas y haptics opcionales. |
| `js/app.js` | Invoca la secuencia de reclamo y abre el modal de hito tras un reclamo exitoso. |
| `docs/sistema-racha-diaria.md` | Contrato técnico y UX del sistema de racha actualizado para el nuevo hub. |
| `README.md` | Versión y estructura de archivos actualizadas. |

---

## Actualización de rendimiento de Tienda (abril 2026)

### Objetivo
Reducir el tiempo de apertura del preview, disminuir carga del DOM en la vista de catálogo y mejorar la fluidez de scroll en catálogos grandes.

### Cambios implementados

1. **Preview simplificado (sin mockups superpuestos)**
   - Se eliminó el render de mockups Mobile/PC en la apertura del modal de preview.
   - El modal ahora monta un frame único (`.preview-art-frame`) con una sola capa de arte y una capa ligera de protección visual.
   - El tamaño del frame se resuelve por tag de negocio: `Mobile`=9:20, `PC`=16:9, `Avatar`=1:1. Si no hay tag reconocido, usa `naturalWidth/naturalHeight` como fallback.
   - Se mantiene la protección básica anti-extracción:
     - Bloqueo de menú contextual (`contextmenu` + `preventDefault`).
     - Capa superpuesta no interactiva (`.preview-art-protection`).

2. **Carga progresiva optimizada del arte**
   - Se conserva el patrón de carga en dos fases (thumbnail inmediata + hi-res diferida).
   - Se mantiene `decoding="async"` para minimizar bloqueos del hilo principal.
   - El fallback offline sigue activo cuando falla la imagen del CDN.

3. **Lazy rendering incremental del catálogo**
   - `renderShop()` fue refactorizada para pintar el catálogo por lotes.
   - Se incorporó un sentinel (`.shop-lazy-sentinel`) con `IntersectionObserver` para agregar nuevas tarjetas solo cuando el usuario se acerca al final del grid.
   - En navegadores sin soporte de `IntersectionObserver`, se aplica fallback progresivo hasta completar el render.

### Beneficios esperados
- Menor tiempo de interacción al abrir preview.
- Menor cantidad de nodos simultáneos en el DOM.
- Scroll más estable y con menos jank en catálogos extensos.
- Menor presión de memoria en dispositivos de gama baja.

---

*Love Arcade · Documentación técnica v14.2 + Ghost Analytics v12.1 (Floating Pill Navigation · Sentinel Cloud Sync · Body Parser Hardening · Telegram Proxy · Doble Candado · Word Hunt Progression Metrics)*
*Arquitectura: vanilla JS + Vercel Serverless + Supabase (Auth + PostgreSQL JSONB) · Compatible con GitHub Pages (frontend) + Vercel (proxy + serverless)*
