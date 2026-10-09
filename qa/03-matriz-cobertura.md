# 03 — Matriz de cobertura

Riesgos R1-R12: [01-diagnostico.md §3](01-diagnostico.md). Prioridad: P0 crítico … P3 cosmético. "Existe" = ya hay cobertura útil en `tests/`.

| # | Área real | Riesgo | Tipo de test | Prioridad | Qué comprobar | Fase |
|---|---|---|---|---|---|---|
| 1 | Store: carga y migración ([state-store.js](../js/core/state-store.js) `migrate`) | Pérdida de datos al migrar saves antiguos o corruptos | Unitario | P0 | JSON corrupto → defaults sin lanzar; `lastDaily` → `daily`; tema legacy → fallback; campos retirados eliminados; tipos inválidos saneados | F2a |
| 2 | Store: `save` y cuota | R6 | Unitario (localStorage con cuota) | P0 | `QuotaExceededError` → cleanup y reintento OK; si el reintento falla, el estado previo no queda corrupto y se notifica; recorte del progreso a 50 por juego | F2a |
| 3 | Economía: `buyItem` | Saldo negativo, doble compra | Unitario (**existe** en tests/domain/economy.test.mjs, ampliar) | P0 | Saldo justo; ya poseído; oferta activa con redondeo; cashback 0; precio 0; R12 (precio dado por el llamador) documentado | F2b |
| 4 | Economía: `spendCoins` / `addCoins` | Montos inválidos | Unitario | P0 | NaN, negativos, decimales (floor), Infinity, string; saldo insuficiente no muta; historial coherente | F2b |
| 5 | `completeLevel` hub y bridge | R1, R2 | Unitario + paridad | P0 | Idempotencia por `gameId+levelId`; montos inválidos; **ambas copias se comportan igual** con la misma tabla de casos | F2b |
| 6 | Historial ([history.js](../js/domain/history.js)) | Crecimiento sin límite | Unitario | P1 | Tope de 50; orden inverso en `getHistory` | F2a |
| 7 | Día lógico ([time-sync.js](../js/core/time-sync.js)) | Racha mal calculada en bordes | Unitario (reloj falso) | P0 | Desfase de 3 h (02:59 frente a 03:00); medianoche; cambio de mes/año; `nextResetTime` | F2c |
| 8 | Caché de tiempo | R5 | Unitario | P1 | Sin caché → `verified:false`; caché caducada; `desynced` bloquea el reclamo; JSON corrupto en caché | F2c |
| 9 | Racha diaria y reparación | Monedas indebidas | Unitario (**existe** en tests/domain/daily-streak.test.mjs, ampliar) | P1 | Escala 20→60 con tope; +90 con la Luna justo en la expiración; reparación solo con diff = 2 y saldo ≥ 500; reloj hacia atrás | F2c |
| 10 | Bendición Lunar | Expiración mal calculada | Unitario | P1 | 100 monedas / 7 días; acumulación si está activa; saldo insuficiente; `extendMoonBlessingDays` con días inválidos | F2d |
| 11 | Promo codes | Reutilización | Unitario (**existe** en tests/domain/promo-codes.test.mjs) | P1 | Normalización (espacios, minúsculas); duplicado; sha256 real | F2d (completar) |
| 12 | `exportSave` / `importSave` | Pérdida accidental de partida, trampa R3 | Integración (sha256 y base64 reales; worker falso que falla → camino fallback) | P0 (corrupción), P1 (R3) | Ida y vuelta conserva el estado; corrupción accidental rechazada sin mutar (P0); manipulación de checksum aceptada o detectada (R3, P1) | F2d |
| 13 | Sentinel: interceptor | Cambios no sincronizados | Integración (localStorage y Supabase falsos) | P1 | Escribir una clave vigilada marca `dirty` y actualiza el timestamp; una no vigilada no; `removeItem` | F3a |
| 14 | Sentinel: LWW al iniciar sesión | R7 | Integración | P1 | Nube más reciente → aplica snapshot y rehidrata el store; local más reciente → sube; empate con diferencias → sube; nube vacía | F3a |
| 15 | Backup `.labak` | R4 | Integración (gzip y crypto reales) | P1 | Ida y vuelta; checksum alterado rechazado; extensión inválida; claves arbitrarias escritas (confirmar R4) | F3a |
| 16 | Bridge en cada juego | R10 | Integración / contrato | P0 | Los 8 `index.html` cargan el bridge clásico (sin `defer`/`async`/`module`) antes del entrypoint; el `GameCenter` del bridge persiste en la misma clave que el hub (existe pero en rojo: tests/game-bridge.test.mjs línea 72, ver línea base en F1) | F3b |
| 17 | SW: precache | R9 | Contrato | P1 | **Cada ruta de `PRECACHE_FILES` existe en disco**; sin duplicados (cubierto por tests/service-worker-precache.test.mjs) | F3b |
| 18 | SW: estrategias de fetch | R8 | Integración (sandbox `vm`) | P1 | Cloudinary offline → caché o icono; mismo origen cache-first; qué pasa con `/api/*` y respuestas 404/500 (confirmar R8); POST ignorado | F3b |
| 19 | `api/report.js` | Abuso o caída del endpoint | Integración del handler | P2 | 405; origen no permitido → 403; localhost/vercel.app OK; sanitización HTML del nickname; Telegram caído → 500 sin filtrar el token; body string/Buffer/undefined | F3b |
| 20 | `api/client-config.js` | Credenciales | Integración del handler | P2 | 405; sin variables de entorno → strings vacíos; `Cache-Control: no-store` | F3b |
| 21 | Flujo: primera carga → reclamar racha (`streak-hub.js`, `hud-render.js`) → saldo visible y persiste tras recargar | Regresión integral | E2E | P0 | — | F4 |
| 22 | Flujo: comprar ítem en la tienda (`shop-logic.js`, `spa-router.js`) → aparece en la colección → recarga | Regresión integral | E2E | P0 | — | F4 |
| 23 | Flujo: completar nivel en un juego (`game-bridge.js`, `hud-render.js`) → el saldo se actualiza | Regresión integral | E2E | P0 | — | F4 |
| 24 | Flujo: canjear código promo (`promo-codes.js`); exportar → limpiar → importar código (`identity.js`) | Regresión integral | E2E | P1 | — | F4 |
| 25 | Navegación SPA home/shop/profile (`spa-router.js`) + Atrás/Adelante | Router | E2E | P2 | — | F4 |
| 26 | Bordes transversales | Corrupción y multipestaña | Unitario/integración | P1 | Evento `storage` sintético (handler no crashea, concurrencia E2E); store a ~4 MB; nickname/promo unicode; claves ausentes en snapshot cloud | F5 |
| 27 | Tests existentes rotos | Suite roja | Mantenimiento | P1 | Ver la auditoría en 01 §4 | F1 |
| 28 | Contrato público `GameCenter` | Romper juegos o SPA | Regresión | P1 | Lista explícita de métodos y forma de las respuestas clave (cubierto por tests/domain/game-center.test.mjs) | F6 |
| 29 | Accesibilidad: login, promo, diálogos, `aria-live` de la racha | Regresión a11y | E2E + axe | P2 | Sin violaciones serias; foco en los diálogos | F7 (condicional) |

**Fuera de cobertura (justificado)**: lógica interna de los 8 minijuegos salvo Marejig (ya tiene tests) y su integración vía bridge; render de Rive y Canvas; RLS de Supabase (verificación humana); R11 (texto plano en comentarios: no es comportamiento, requiere decisión humana).
