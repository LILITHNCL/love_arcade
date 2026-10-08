# Diagnóstico del repositorio: Love Arcade

**Fecha**: 2026-10-08  
**Sesión**: 1 (Diagnóstico inicial)  
**Autor**: Agente Senior de QA y Testing  
**Referencia normativa**: [AGENTS.md](file:///data/data/com.termux/files/home/proyectos/love_arcade/AGENTS.md) y [/qa/ESTRATEGIA-AGENTE.md](file:///data/data/com.termux/files/home/proyectos/love_arcade/qa/ESTRATEGIA-AGENTE.md)

---

## 1. Arquitectura del sistema

Love Arcade es una plataforma web de minijuegos retro y economía virtual estructurada como una **Single Page Application (SPA) estática** y **Progressive Web App (PWA)**, construida con HTML5, CSS3 y JavaScript vanilla clásico (ES6+), sin bundlers (Webpack, Vite, Rollup) ni frameworks de frontend (React, Vue, Svelte).

```
┌────────────────────────────────────────────────────────────────────────┐
│                              NAVEGADOR / PWA                           │
│                                                                        │
│   ┌────────────────────┐   ┌───────────────────┐   ┌───────────────┐  │
│   │    index.html      │   │   js/spa-router   │   │  styles.css   │  │
│   │  (Shell estático)  │◄──┤  (Vistas / Nav)   │◄──┤ (Tema / GPU)  │  │
│   └─────────┬──────────┘   └─────────┬─────────┘   └───────────────┘  │
│             │                        │                                 │
│   ┌─────────▼────────────────────────▼────────┐                       │
│   │               CAPA DE UI                  │                       │
│   │  • hud-render.js       • coin-display.js  │                       │
│   │  • streak-hub (Rive)   • theme-grid.js    │                       │
│   │  • shop-logic.js       • micro-interact.  │                       │
│   └─────────────────────┬─────────────────────┘                       │
│                         │                                             │
│   ┌─────────────────────▼─────────────────────┐                       │
│   │             FACHADA UNIFICADA             │                       │
│   │   window.GameCenter (game-center.js)      │                       │
│   └───────▲─────────────────────────────┬─────┘                       │
│           │                             │                             │
│   ┌───────┴───────────────┐     ┌───────▼──────────────────────────┐  │
│   │  MINIJUEGOS (/games)  │     │         CAPA DE DOMINIO          │  │
│   │  • 2048   • Dodger    │     │  • economy.js   • daily-streak   │  │
│   │  • Jigsaw • Shooter   │     │  • history.js   • promo-codes    │  │
│   │  • Jungle • Rompecab. │     │  • identity.js  • moon-blessing  │  │
│   │  • Ollin  • Word-Hunt │     │  • avatar.js    • theming.js     │  │
│   │          ▲            │     └───────────────┬──────────────────┘  │
│   │          │            │                     │                     │
│   │   game-bridge.js      │     ┌───────────────▼──────────────────┐  │
│   │   game-bridge-runtime │     │          CAPA DE CORE            │  │
│   └───────────────────────┘     │  • state-store (LoveArcadeStore) │  │
│                                 │  • config.js   • time-sync.js    │  │
│                                 │  • sync-worker • utils.js        │  │
│                                 └───────────────┬──────────────────┘  │
│                                                 │                     │
│   ┌─────────────────────────────────────────────▼──────────────────┐  │
│   │                 PERSISTENCIA LOCAL & WORKERS                   │  │
│   │  • localStorage (gamecenter_v6_promos, love_arcade_time_cache) │  │
│   │  • Service Worker (sw.js - Cache API App Shell + 8 Juegos)     │  │
│   │  • Web Worker (sync-worker.js - SHA-256 + Gzip + Base64)       │  │
│   │  • BackupEngine (backup-engine.js - Export/Import .labak)      │  │
│   └─────────────────────┬──────────────────────────────────────────┘  │
└─────────────────────────┼─────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SERVICIOS EXTERNOS / CLOUD                      │
│                                                                        │
│   ┌───────────────────────┐   ┌───────────────────┐   ┌────────────┐   │
│   │   Vercel Serverless   │   │  Supabase Cloud   │   │ Cloudinary │   │
│   │  • /api/client-config │   │  • user_profiles  │   │  • Thumbs  │   │
│   │  • /api/report        │   │  • avatars bucket │   │  • Wallp.  │   │
│   │  • /api/telemetry     │   │  • Auth / RLS     │   │  • Covers  │   │
│   └───────────────────────┘   └───────────────────┘   └────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Componentes arquitectónicos y patrones

1. **Bootstrap y evaluación síncrona**:
   - `index.html` incluye un script inline en el `<head>` para temática *zero-flicker*, inyectando variables CSS antes del primer paint según el valor almacenado en `localStorage`.
   - Los scripts se cargan de forma clásica y bloqueante en un orden estricto de dependencias:
     `analytics` → `supabase-loader` → `lifecycle-scheduler` → `core/config` → `core/utils` → `core/sync-worker-client` → `core/time-sync` → `core/state-store` → `cloud/sentinel` → `domain/history` → `domain/economy` → `domain/promo-codes` → `domain/moon-blessing` → `domain/identity` → `domain/daily-streak` → `domain/avatar` → `domain/theming` → `ui/theme-grid` → `domain/game-center` → `ui/coin-display` → `ui/hud-render` → `ui/micro-interactions` → `pwa/sw-update-bridge` → `app` → `backup-engine` → `shop-logic` → `streak-hub` → `spa-router`.
   - `js/app.js` es un orquestador minimalista de 38 líneas que coordina la carga inicial sin poseer lógica de negocio.

2. **Capa de estado y store global**:
   - `js/core/state-store.js` expone `window.LoveArcadeStore`. Es la fuente única de verdad para el estado de la aplicación bajo la clave `gamecenter_v6_promos` en `localStorage`.
   - Incorpora migración de versiones, saneamiento de esquemas corruptos, suscripción a mutaciones y gestión de cuota de almacenamiento (`trimGameProgress`, `emergencyCleanup`).

3. **Fachada de dominio (`window.GameCenter`)**:
   - `js/domain/game-center.js` unifica todas las operaciones de negocio (`completeLevel`, `buyItem`, `spendCoins`, `addCoins`, `claimDaily`, `repairDailyStreak`, `buyMoonBlessing`, `redeemPromoCode`, `exportSave`, `importSave`, `setAvatar`, `setTheme`, etc.) en una sola API pública estable consumida tanto por la SPA como por los minijuegos.

4. **Integración con Minijuegos (Game Bridge)**:
   - Los 8 minijuegos ubicados en `/games/*` (`2048`, `Dodger`, `Shooter`, `jigsaw`, `jungle-dash`, `ollin-smash`, `rompecabezas`, `word-hunt`) operan en subdirectorios bajo el mismo origen.
   - Se integran mediante `js/game-bridge.js`, que utiliza `document.write` durante el parseo HTML para cargar síncronamente el runtime `js/game-bridge-runtime.js` y las dependencias de núcleo/dominio necesarias. Esto expone un subconjunto seguro de `window.GameCenter` sin cargar la UI ni el bootstrap del hub principal.

5. **Sincronización en la nube (Patrón Sentinel)**:
   - `js/cloud/sentinel.js` implementa `window.Sentinel` como un observador no invasivo.
   - Monkey-patchea `localStorage.setItem` para detectar escrituras en claves vigiladas del hub y de los minijuegos.
   - Aplica subidas debounced a la tabla `user_profiles` de Supabase y resuelve conflictos entre dispositivos usando resolución *Last-Write-Wins* basada en timestamps (`love_arcade_sentinel_ts`).
   - `api/client-config.js` provee las credenciales públicas de Supabase mediante una Edge Function sin hardcodearlas en el cliente.

6. **PWA y Estrategia Offline**:
   - `sw.js` registra un Service Worker con dos listas declarativas: `APP_SHELL_FILES` (49 recursos) y `GAMES_FILES` (81 recursos). Ambas se combinan en `PRECACHE_FILES` y se descargan atómicamente con `caches.open(CACHE_NAME).addAll(PRECACHE_FILES)`.
   - Soporta navegación e interacción 100% offline para los minijuegos y la tienda.
   - Cache First para recursos estáticos locales y Cloudinary; Network First / Stale-While-Revalidate según el caso.

7. **Vistas SPA y Transiciones**:
   - `js/spa-router.js` gobierna tres vistas: `home`, `shop` y `profile`.
   - Gestiona el historial con la History API (`popstate`, `pushState`, `replaceState`).
   - Aplica transiciones por GPU (`opacity` y `transform`) y coordina callbacks de ciclo de vida (`onEnter`, `onLeave`) mediante tareas cooperativas en `requestAnimationFrame` y `requestIdleCallback`.

---

## 2. Funcionalidades por criticidad (con evidencia en código)

### P0 — Críticas / Núcleo Vital
Cualquier fallo aquí destruye la integridad del juego, corrompe datos del usuario o rompe la economía del producto.

| Funcionalidad | Evidencia en código | Justificación y riesgo |
|---|---|---|
| **Persistencia del Store Global y Migraciones** | [`LoveArcadeStore`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/core/state-store.js#L3-L75)<br>Clave: `CONFIG.stateKey = 'gamecenter_v6_promos'` en [`js/core/config.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/core/config.js#L7) | Si `migrate()` o `replaceStore()` fallan, el jugador pierde saldo, inventario, rachas y progreso de todos los juegos. |
| **Economía: Saldo, Compras, Deducciones y Cashback** | [`buyItem()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/economy.js#L7-L34)<br>[`spendCoins()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/economy.js#L36-L45)<br>[`addCoins()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/economy.js#L47-L55)<br>Constante `ECONOMY` en [`js/core/config.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/core/config.js#L17-L22) | Controla el flujo de monedas virtual. Errores de redondeo, duplicación de saldo o compras no atómicas rompen el modelo de progresión. |
| **Contrato del Game Bridge con Minijuegos** | [`initLoveArcadeGameBridge()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/game-bridge.js#L3-L36)<br>[`completeLevel()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/game-bridge-runtime.js#L12-L21)<br>Superficie `window.GameCenter` en [`js/game-bridge-runtime.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/game-bridge-runtime.js#L25-L34) | Si el bridge no inyecta las dependencias o `completeLevel` permite pagar dos veces por el mismo nivel (`store.progress[gameId].includes(levelId)`), se altera la economía desde los juegos. |
| **Integridad Horaria y Detección de Desincronización** | [`LoveArcadeTime.read()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/core/time-sync.js#L43-L53)<br>[`_getDailyDiffDays()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/core/time-sync.js#L59-L65)<br>Constante `CLOCK_SKEW_LIMIT` en [`js/core/time-sync.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/core/time-sync.js#L8) | Previene trampas al manipular el reloj del sistema operativo para reclamar bonos diarios infinitos o rachas falsas. |
| **Registro de Transacciones e Historial** | [`logTransaction()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/history.js#L5-L19)<br>[`getHistory()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/history.js#L21-L24) | Auditoría local de cada ingreso y gasto. Limita el historial a 100 entradas para evitar desbordamiento de cuota. |

---

### P1 — Alta Criticidad / Flujos Primarios
Sistemas esenciales para la retención del jugador, persistencia multidispositivo y monetización/catálogo.

| Funcionalidad | Evidencia en código | Justificación y riesgo |
|---|---|---|
| **Racha Diaria y Reparación de Racha** | [`claimDaily()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/daily-streak.js#L26-L105)<br>[`repairDailyStreak()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/daily-streak.js#L107-L141)<br>[`_getDailyRepairState()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/daily-streak.js#L10-L23) | Mecánica central de retención (20 a 60 monedas base escalonadas + 90 por Bendición Lunar). Reparación cuesta 500 monedas si se perdió exactamente 1 día (`diffDays === 2`). |
| **Bendición Lunar (Multiplicador de Racha)** | [`buyMoonBlessing()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/moon-blessing.js#L18-L41)<br>[`getMoonBlessingStatus()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/moon-blessing.js#L54-L64) | Costo: 1,500 monedas por 30 días de vigencia. Un fallo en el cálculo de expiración (`moonBlessingExpiry`) causa pérdida de valor para el jugador. |
| **Códigos Promocionales con SHA-256** | [`redeemPromoCode()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/promo-codes.js#L30-L59)<br>Tabla `PROMO_CODES_HASHED` en [`js/domain/promo-codes.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/promo-codes.js#L6-L17) | Los códigos no van en texto plano; se normalizan a mayúsculas y se hashean con `crypto.subtle.digest`. Se registran en `redeemedHashes` para evitar reutilización. |
| **Sincronización Cloud Sentinel (Supabase)** | [`SentinelCloudSync`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/cloud/sentinel.js#L52-L95)<br>Interceptor `localStorage.setItem`<br>Tabla `user_profiles` | Sincroniza 18 claves de almacenamiento local con debounce y resolución *Last-Write-Wins*. Si falla silenciosamente, el jugador pierde el progreso en otros dispositivos. |
| **Exportación e Importación de Partidas (.labak / Base64)** | [`exportSave()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/game-center.js#L26-L38)<br>[`importSave()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/game-center.js#L40-L64)<br>[`BackupEngine`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/backup-engine.js#L5-L100)<br>[`sync-worker.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/sync-worker.js#L17-L50) | Mecanismo de contingencia sin conexión: exporta e importa snapshots protegidos con checksum SHA-256 y compresión Gzip (`CompressionStream`). |
| **Catálogo de Tienda y Descargas Cloudinary** | [`loadCatalog()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/shop-logic.js#L78-L100)<br>[`getDownloadUrl()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/economy.js#L73-L81)<br>Archivo de datos: [`data/shop.json`](file:///data/data/com.termux/files/home/proyectos/love_arcade/data/shop.json#L1-L30) | Catálogo de 181 fondos de pantalla. Genera URLs seguras con Cloudinary (`fl_attachment`). |
| **PWA Cache y Disponibilidad Offline** | Evento `install` con `addAll(PRECACHE_FILES)` en [`sw.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/sw.js#L97-L102)<br>Evento `fetch` en [`sw.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/sw.js#L112-L148) | Garantiza que la SPA y los minijuegos sigan funcionando sin conexión a internet. |

---

### P2 — Criticidad Media / Experiencia y Ajustes
Funcionalidades que mejoran la experiencia de usuario y personalización sin comprometer directamente la economía base.

| Funcionalidad | Evidencia en código | Justificación y riesgo |
|---|---|---|
| **Enrutador SPA y Ciclo de Vida** | [`navigateTo()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/spa-router.js#L30-L45)<br>[`_applyView()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/spa-router.js#L12-L28)<br>Callbacks `HomeView.onLeave`, `ShopView.onLeave` | Controla la navegación sin recargas. Transición visual de 250ms con GPU (`opacity` y `transform`). |
| **Personalización de Avatar** | [`setAvatar()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/avatar.js#L15-L60)<br>[`getAvatar()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/avatar.js#L62-L70)<br>Compresión Canvas a WebP/JPEG (`AVATAR_MAX_LOCAL_KB = 100`) | Procesa imágenes locales, las comprime y opcionalmente las sube al bucket `avatars` de Supabase Storage. |
| **Selector de Temas (Zero-Flicker)** | [`setTheme()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/domain/theming.js#L10-L45)<br>Script inline en `<head>` de [`index.html`](file:///data/data/com.termux/files/home/proyectos/love_arcade/index.html)<br>Selector [`js/ui/theme-grid.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/ui/theme-grid.js) | 25 temas cromáticos con roles de color derivados en espacio sRGB. |
| **Animación Rive de Racha Diaria** | [`initStreakHub()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/ui/streak-hub.js#L2-L50)<br>Lazy load de runtime Rive 2.44.0 WASM | Presentación visual enriquecida del fuego de la racha; posee fallback accesible y control de rendimiento con `IntersectionObserver`. |
| **Telemetría y Reportes Serverless** | [`GhostAnalytics.track()`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/analytics.js)<br>[`api/report.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/api/report.js#L27-L60)<br>[`api/telemetry.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/api/telemetry.js#L1-L12) | Envío de telemetría, errores y métricas anónimas a canales de Telegram mediante Edge Functions en Vercel. |

---

### P3 — Baja Criticidad / Cosméticos y Microinteracciones
Detalles de pulido sensorial que pueden degradarse sin afectar el juego ni la navegación.

| Funcionalidad | Evidencia en código | Justificación |
|---|---|---|
| **Feedback Háptico y Microinteracciones** | [`js/ui/micro-interactions.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/ui/micro-interactions.js)<br>`navigator.vibrate` | Vibración sutil al pulsar botones táctiles. Si el navegador no lo soporta, se degrada limpiamente. |
| **Efectos de Partículas y Confetti** | Confetti dinámico en compras en [`js/shop-logic.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/shop-logic.js#L90-L98)<br>Partículas de racha en [`js/ui/hud-render.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/ui/hud-render.js#L15-L33) | Animaciones decorativas respetando `prefers-reduced-motion`. |
| **Aviso de Actualización PWA** | [`js/pwa/sw-update-bridge.js`](file:///data/data/com.termux/files/home/proyectos/love_arcade/js/pwa/sw-update-bridge.js) | Toast no invasivo notificando nueva versión del Service Worker. |

---

## 3. Superficie de riesgo

A partir de la inspección del código, se identifican los siguientes puntos de vulnerabilidad y posibles modos de fallo:

### 3.1. Concurrencia y colisión en almacenamiento local (`localStorage`)
- **Riesgo**: Sentinel intercepta `localStorage.setItem` sincrónicamente para 18 claves. Si un minijuego escribe rápidamente en un bucle (por ejemplo, guardando coordenadas o puntuaciones frame a frame) mientras el hub procesa compras o transacciones, puede saturarse la cola de debounce o generarse carreras entre pestañas abiertas (*cross-tab state overwrites*).
- **Riesgo de cuota**: Los navegadores limitan `localStorage` a ~5 MB por origen. Si se almacenan avatares en Base64 o historiales extensos de partidas de 8 minijuegos distintos, se alcanzará `QuotaExceededError`. `state-store.js` incluye `emergencyCleanup()` y `trimGameProgress()`, pero no todos los juegos respetan el límite unificado.

### 3.2. Asincronía y ataques de manipulación temporal
- **Riesgo**: `daily-streak.js` y `time-sync.js` protegen contra saltos de reloj hacia atrás (`now < lastClaim`) y hacia adelante (`CLOCK_SKEW_LIMIT = 5 min`), pero dependen de un caché de red con TTL de 4 horas (`TIME_CACHE_KEY = 'love_arcade_time_cache'`).
- Si el usuario juega 100% offline durante días, el sistema debe degradar a la hora del dispositivo sin bloquear al usuario legítimo, abriendo una ventana donde el usuario podría manipular la fecha para forzar el bono diario.

### 3.3. Fragilidad del precaché PWA en despliegues atómicos
- **Riesgo**: En `sw.js`, `PRECACHE_FILES` concatena 130 URLs estáticas exactas (`APP_SHELL_FILES` + `GAMES_FILES`). La llamada `caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_FILES))` es **atómica**: si **un solo archivo** de los 130 devuelve error 404 (por ejemplo, si se renombra un asset de un minijuego y no se actualiza la lista en `sw.js`), la instalación completa del Service Worker falla silenciosamente, dejando al usuario sin soporte offline ni actualizaciones.

### 3.4. Acoplamiento del Game Bridge por `document.write`
- **Riesgo**: `js/game-bridge.js` utiliza deliberadamente `document.write('<script src="..."></script>')` para garantizar la ejecución bloqueante y secuencial en navegadores clásicos antes de que los scripts del juego arranquen.
- Si en el futuro un minijuego se refactoriza para cargar scripts con `<script type="module">` o con atributos `defer` / `async`, `document.write` lanzará una advertencia o error en navegadores modernos y la inyección fallará, dejando `window.GameCenter` indefinido dentro del juego.

### 3.5. Seguridad client-side y exposición de hashes
- **Riesgo**: Los códigos promocionales están protegidos por SHA-256 en `js/domain/promo-codes.js`, pero el diccionario de hashes está expuesto en el bundle del cliente (`PROMO_CODES_HASHED`). Un atacante puede ejecutar un ataque de fuerza bruta o diccionario offline localmente en microsegundos y descubrir todos los códigos activos.
- Las credenciales de Supabase expuestas vía `/api/client-config` son de solo lectura de la *Anon Key*, protegidas únicamente por Row Level Security (RLS) en la base de datos PostgreSQL. Cualquier fallo en las políticas RLS de Supabase expondría los perfiles de todos los jugadores.

---

## 4. Auditoría de los tests existentes

Se analizaron los **13 archivos de prueba** en el directorio `/tests` y los **20 archivos de prueba** en `/games/jigsaw/test`.

### 4.1. Tests en el directorio raíz (`/tests`)

| Archivo de test | Estado actual | ¿Qué valida? | Veredicto | Diagnóstico y justificación técnica |
|---|---|---|---|---|
| `tests/domain/economy.test.mjs` | **PASA** | Saldo, compras, cashback, descuento, deducciones, histórico de transacciones. | **CONSERVAR** | Test de dominio de alta calidad. Usa `node:vm` para aislar `LoveArcadeStore` y `LoveArcadeEconomy`. Prueba comportamiento real y contratos numéricos. |
| `tests/domain/daily-streak.test.mjs` | **PASA** | Cálculo de racha, continuidad (1 día), ruptura (>2 días), reparación (2 días, 500 monedas), bonos base y lunar. | **CONSERVAR** | Excelente cobertura del motor de tiempo simulado con `MockDate`. Verifica reglas de negocio críticas sin tocar el DOM. |
| `tests/domain/avatar.test.mjs` | **PASA** | Manejo de avatar local, compresión, fallback cuando Supabase falla, sesión ausente. | **CONSERVAR** | Mockea adecuadamente `Image`, `Blob` y `FileReader`. Valida degradación elegante y persistencia. |
| `tests/domain/promo-codes.test.mjs` | **PASA** | Canje de códigos válidos, detección de duplicados, códigos inválidos, integración con `sha256`. | **CONSERVAR** | Prueba lógica de negocio y resistencia a repetición con mocks limpios. |
| `tests/domain/game-center.test.mjs` | **PASA** | Superficie pública completa de `window.GameCenter`, integración de `completeLevel`, persistencia. | **CONSERVAR** | Valida el contrato que consumen la SPA y los 8 minijuegos. |
| `tests/service-worker-precache.test.mjs` | **PASA** | Unicidad de recursos en precaché, llamada atómica a `cache.addAll()`, ausencia de URLs duplicadas. | **CONSERVAR** | Previene que el Service Worker falle al instalarse por duplicados en `Cache.addAll()`. |
| `tests/shop-catalog-static-qa.mjs` | **PASA** | Esquema del catálogo `data/shop.json`, unicidad de 181 IDs, nombres no vacíos, categorías válidas. | **CONSERVAR** | Asegura la integridad del catálogo de producción antes de desplegar. |
| `tests/interactive-haptics-static-qa.mjs` | **PASA** | Comprueba que las microinteracciones existan en el DOM y código. | **MODIFICAR** | Usa regex sobre código fuente en lugar de comprobar comportamiento de interfaz. Debe evolucionar hacia pruebas funcionales sin selectores frágiles. |
| `tests/player-hud-static-qa.mjs` | **PASA** | Comprueba reglas CSS estáticas y clases del HUD del jugador. | **MODIFICAR** | Comprobación estática de strings CSS que no verifica el renderizado real y es propensa a romperse ante cambios de diseño legítimos. |
| `tests/game-bridge.test.mjs` | **FALLA** | Contrato de carga de minijuegos y versión del Service Worker. | **MODIFICAR** | **Causa de fallo**: Tiene hardcodeado `assert.match(serviceWorker, /const CACHE_VERSION = 'v2\.04\.07\.58';/)`, mientras que `sw.js` está actualmente en `'v2.04.07.65'`. La parte del bridge de minijuegos pasa perfectamente; el fallo es por verificar una versión literal hardcodeada en vez de un patrón semántico. |
| `tests/rive-streak-lifecycle.test.mjs` | **FALLA** | Ciclo de vida del componente Rive para racha diaria. | **MODIFICAR** | **Causa de fallo**: Verifica por regex la cadena literal `/stateMachine:\s*['"]State Machine 1['"]/` dentro del archivo `streak-hub.js`, pero el código fue refactorizado para usar la constante `stateMachine: STATE_MACHINE,`. El mock del ciclo de vida Rive es útil; debe corregirse la aserción de código fuente para probar comportamiento en vez de sintaxis textual. |
| `tests/daily-streak-hub-qa.mjs` | **FALLA** | Valida atributos HTML, comentarios y CSS del hub de racha. | **ELIMINAR** | **Causa de fallo**: Busca texto literal en comentarios HTML (`Animación “Dynamic streak fire” por aristote · CC BY`) y tiene aserciones mutuamente contradictorias sobre unidades `dvh` en CSS. Es el ejemplo perfecto de test antipatrón que comprueba implementación exacta y comentarios. Debe eliminarse o reescribirse desde cero. |
| `tests/documentation-static-qa.mjs` | **FALLA** | Escanea todos los archivos de texto buscando términos obsoletos (`streak-flame`, etc.). | **MODIFICAR** | **Causa de fallo**: Falla porque `tests/daily-streak-hub-qa.mjs` contiene los términos obsoletos dentro de sus aserciones negativas (`assert.doesNotMatch`). Debe ignorar la carpeta `tests/` o excluirse una vez saneados los tests. |

---

### 4.2. Tests en minijuegos (`/games/jigsaw/test`)

El juego Marejig (Jigsaw) cuenta con 20 archivos de prueba heredados de fases anteriores:

- **Tests Playwright E2E** (`phase4_smoke_playwright.js`, `phase5_smoke_playwright.js`, `phase6_smoke_playwright.js`, `phase7_smoke_playwright.js`):
  - **Estado**: **Fallan** con `MODULE_NOT_FOUND` al requerir `playwright` (excepto `phase7` que detecta la ausencia y la omite de forma segura).
  - **Veredicto**: **CONSERVAR PERO AISLAR**. No deben formar parte de la suite que se ejecuta en terminales locales sin navegadores gráficos. Se deben marcar para verificación en entornos desktop / CI.
- **Tests unitarios específicos de refactor** (`phase14_victory_redesign_unit.mjs`):
  - **Estado**: **Falla**.
  - **Causa**: Exige con regex la presencia de `<script src="../../js/app.js"></script>` en `games/jigsaw/index.html`. Esta línea fue eliminada deliberadamente al desacoplar los minijuegos de la UI del hub mediante `game-bridge.js`.
  - **Veredicto**: **MODIFICAR O ELIMINAR**. Está probando una arquitectura ya deprecada que contradice los tests del game-bridge.
- **Test de estrés procedural** (`phase7_unit.mjs`):
  - **Estado**: **Falla**.
  - **Causa**: Genera 200 niveles procedurales complejos y tiene una aserción de tiempo estricta: `assert.ok(elapsedMs < 20000)`. En procesadores móviles ARM (Termux), la generación determinista tarda ~56 segundos. La lógica algorítmica es 100% correcta, pero falla por el umbral de reloj dependiente del hardware.
  - **Veredicto**: **MODIFICAR**. Quitar o flexibilizar el umbral de tiempo arbitrario o parametrizar el tamaño del lote.
- **14 Tests unitarios de lógica procedural, generador y escena** (`phase4_unit.js`, `phase5_unit.js`, `phase6_unit.js`, `phase8_audit.mjs`, `phase9_sandbox_unit.mjs`, `phase10_...` a `phase17_...`, `reward_balance_unit.mjs`):
  - **Estado**: **PASAN** todos en Node.js.
  - **Veredicto**: **CONSERVAR**. Prueban la lógica matemática, generación de piezas de puzzle y empaquetado de estados del juego sin depender de navegadores.

---

## 5. Comprobación del entorno de ejecución local

Se ejecutó una auditoría exhaustiva del entorno local para determinar las capacidades reales de ejecución y delimitar qué pruebas se pueden correr de forma automatizada y cuáles requerirán verificación humana externa.

### 5.1. Datos técnicos del sistema

| Parámetro | Valor detectado | Impacto en testing |
|---|---|---|
| **Sistema Operativo** | Linux (Android Termux) `localhost` | Entorno emulado/sandboxed en espacio de usuario Android. Sin systemd ni servicios estándar de escritorio. |
| **Arquitectura CPU** | `aarch64` (ARM 64-bit) | Rendimiento de CPU móvil. Los benchmarks y tests con umbrales fijos de tiempo en milisegundos pueden tardar más que en estaciones x86_64. |
| **Kernel** | `4.14.190-perf` | Soporte completo de POSIX básico, sockets y procesos. |
| **Node.js** | **v26.4.0** (`/data/data/com.termux/files/usr/bin/node`) | **Excelente soporte**. Incluye el runner nativo `node --test`, soporte completo de ESM, `node:assert`, `node:vm`, `node:crypto` y `node:fs`. |
| **npm** | **11.20.0** (`/data/data/com.termux/files/usr/bin/npm`) | Disponible para gestión de paquetes si se requiriera. |
| **Gestión de dependencias** | **Sin `package.json` en el repositorio** | El repositorio no cuenta con `package.json` ni carpeta `node_modules`. Todos los scripts y tests corren con módulos nativos de Node.js. |
| **Navegadores instalados** | `chromium`: **NO**<br>`google-chrome-stable`: **NO**<br>`playwright`: **NO** | `which chromium`, `which google-chrome-stable` y `which playwright` no arrojan ejecutables en el PATH. No hay servidor gráfico X11 ni Wayland activo. |
| **Python** | Python 3.12 (`/data/data/com.termux/files/usr/bin/python3`) | Disponible como herramienta auxiliar si se necesitara. |

---

### 5.2. Qué se PUEDE ejecutar en este entorno
1. **Tests unitarios y de dominio en Node.js nativo**:
   - Ejecución inmediata mediante el test runner nativo de Node.js (`node --test`) o como scripts ESM/CJS directos (`node tests/...`).
   - Cero dependencias externas requeridas: utiliza `node:assert`, `node:fs`, `node:vm`, `node:crypto`.
2. **Pruebas de componentes de navegador usando `node:vm`**:
   - Simulación limpia de entornos de navegador (`window`, `localStorage`, `Date`, `document.createElement`, mocks de observers) mediante contextos aislados de `node:vm`.
3. **Validación estática de esquemas, catálogos e integridad**:
   - Análisis de JSON (`data/shop.json`), verificación de manifiestos PWA, consistencia de archivos y Service Worker.
4. **Verificación por mutación**:
   - Mutación de lógica de negocio en archivos de dominio y comprobación de fallos en los tests.

---

### 5.3. Qué NO se PUEDE ejecutar en este entorno (Límites)
1. **Tests E2E con navegadores reales (Playwright / Puppeteer)**:
   - Los tests de Playwright requieren binarios de Chromium/Firefox/WebKit compilados para la arquitectura y librerías del sistema que no están disponibles de forma nativa en este entorno Termux.
2. **Pruebas visuales de renderizado Canvas y Rive en GPU**:
   - La decodificación nativa de texturas WebGL y aceleración por hardware en Rive no se puede renderizar visualmente aquí.
3. **Estrategia ante estas limitaciones**:
   - Toda suite de tests desarrollada para la plataforma debe ser **100% ejecutable localmente con `node --test` y `node:vm`**.
   - Los tests E2E y de navegador real existentes se documentarán en `/qa/VERIFICACION-HUMANA-FASE-N.md` con las instrucciones exactas para que el usuario humano los ejecute en su máquina desktop o en un runner de CI.

---

## 6. Conclusiones y siguientes pasos

1. **La base de código está bien estructurada pero carece de un marco unificado de pruebas**:
   - Existen excelentes tests de dominio en `tests/domain/` que demuestran la viabilidad de probar lógica de navegador clásica en Node.js puro usando `node:vm`.
   - Existen varios tests frágiles que fallan por comprobar cadenas de texto, versiones literales o comentarios en vez de comportamiento (`tests/game-bridge.test.mjs`, `tests/rive-streak-lifecycle.test.mjs`, `tests/daily-streak-hub-qa.mjs`).
2. **El entorno es idóneo para una suite ágil basada en `node --test`**:
   - Al no depender de `package.json` ni requerir instalación de pesados frameworks, la suite corre en menos de 1 segundo de forma totalmente reproducible.
3. **Fase siguiente**:
   - Avanzar a la definición de `/qa/02-estrategia.md` y `/qa/00-plan-maestro.md`, estableciendo los tipos de tests autorizados, convenciones de estructura y el plan de cobertura por fases según lo estipulado en `/qa/ESTRATEGIA-AGENTE.md`.
