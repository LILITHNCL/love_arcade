# 01 — Diagnóstico del repositorio (Love Arcade)

Sesión 1 (revisado en la sesión 2). Todas las afirmaciones citan ruta y función. Los enlaces son relativos al repo para que `tests/documentation-static-qa.mjs` pueda resolverlos.

> **Corrección (sesión 2).** La primera versión de este archivo tenía datos sin verificar y algunos falsos: Bendición Lunar "1500 monedas/30 días" (en realidad son 100 monedas/7 días), historial "100 entradas" (son 50), Python "3.12" (es 3.14.6), estrategia del SW para Cloudinary descrita como cache-first (es network-first), rangos de líneas inventados. Además usaba enlaces `file://` y mencionaba un término legacy, lo que añadía 49 fallos a `tests/documentation-static-qa.mjs`. Todo esto se ha corregido aquí.

## 1. Arquitectura

- **Tipo**: SPA estática + PWA en HTML/CSS/JS vanilla con scripts clásicos. No hay bundler, ni `package.json`, ni dependencias npm ([ARCHITECTURE.md](../docs/ARCHITECTURE.md), §Estado).
- **Arranque**: [index.html](../index.html) carga los scripts en orden estricto (core → cloud/sentinel → domain → ui → app → shop-logic → streak-hub → spa-router). Un script inline en `<head>` aplica el tema antes del primer paint.
- **Estado**: [state-store.js](../js/core/state-store.js) expone `window.LoveArcadeStore` (`migrate` L14, `replaceStore` L70, `save` L139, `emergencyCleanup` L100) sobre `localStorage['gamecenter_v6_promos']` ([config.js](../js/core/config.js) L7).
- **Dominio**: módulos IIFE en `js/domain/` que se ensamblan en la fachada `window.GameCenter` ([game-center.js](../js/domain/game-center.js) L66+).
- **Minijuegos** (8, en `games/*`): cargan [game-bridge.js](../js/game-bridge.js), que inyecta las dependencias con `document.write` (L34), y [game-bridge-runtime.js](../js/game-bridge-runtime.js), que expone un `GameCenter` reducido (L25-34).
- **Cloud**: [sentinel.js](../js/cloud/sentinel.js) intercepta `localStorage.setItem/removeItem` (L430-462) para 19 claves vigiladas (L56-76), sube a la tabla Supabase `user_profiles` y resuelve conflictos con Last-Write-Wins por timestamp (L386-410).
- **Serverless (Vercel)**: [client-config.js](../api/client-config.js) (credenciales públicas de Supabase), [report.js](../api/report.js) (proxy a Telegram, con validación de método y origen L173-225), [telemetry.js](../api/telemetry.js) (alias).
- **PWA**: [sw.js](../sw.js). En la instalación precachea `APP_SHELL_FILES + GAMES_FILES` de forma atómica (L95-101). Estrategias: **network-first con fallback a caché para Cloudinary** (L118-130) y **cache-first para todo GET del mismo origen** (L132-141).
- **Workers/backup**: [sync-worker.js](../js/sync-worker.js) (SHA-256, gzip, base64), [sync-worker-client.js](../js/core/sync-worker-client.js) (`workerTask`), [backup-engine.js](../js/backup-engine.js) (`.labak`, `exportBackup` L129, `importBackupFromFile` L173).
- **Router**: [spa-router.js](../js/spa-router.js) (`_applyView` L148, `navigateTo` L243) sobre las vistas `home | shop | profile`, con la History API.

## 2. Funcionalidades por criticidad

### P0 — si fallan, se pierden datos o se rompe la economía
| Funcionalidad | Evidencia |
|---|---|
| Carga, migración y guardado del store (incluido el manejo de cuota) | `migrate` L14-50, `save` L139-166, `emergencyCleanup` L100-121 en [state-store.js](../js/core/state-store.js) |
| Compra con descuento y cashback; gastar y añadir monedas | `buyItem` L7-34, `spendCoins` L36-45, `addCoins` L47-55 en [economy.js](../js/domain/economy.js) |
| Recompensa idempotente por nivel (hub y bridge) | `completeLevel` en [game-center.js](../js/domain/game-center.js) L16-24 y en [game-bridge-runtime.js](../js/game-bridge-runtime.js) L12-21 (**lógica duplicada**) |
| Contrato del bridge con los juegos | [game-bridge.js](../js/game-bridge.js) L4-35 |
| Historial de transacciones (máximo 50) | `logTransaction` en [history.js](../js/domain/history.js) L15-17 |

### P1 — retención y persistencia
| Funcionalidad | Evidencia |
|---|---|
| Racha diaria: 20 + 5·(n-1) con tope de 60, +90 con la Luna; reparación por 500 si `diffDays === 2` | `claimDaily` L26-105, `repairDailyStreak` L107-130 en [daily-streak.js](../js/domain/daily-streak.js) |
| Día lógico con desfase de 3 h y caché de tiempo de red (TTL 4 h) | `_getDailyDiffDays` L59, `_readTimeCache` L70-90 en [time-sync.js](../js/core/time-sync.js) |
| Bendición Lunar: 100 monedas, 7 días, acumulable | `buyMoonBlessing` y `extendMoonBlessingDays` en [moon-blessing.js](../js/domain/moon-blessing.js) |
| Códigos promocionales (SHA-256, sin reutilización) | `redeemPromoCode` en [promo-codes.js](../js/domain/promo-codes.js) |
| Exportar/importar código de partida (checksum con salt) | `exportSave` L26-38, `importSave` L40-64 en [game-center.js](../js/domain/game-center.js) |
| Backup `.labak` | [backup-engine.js](../js/backup-engine.js) L129-226 |
| Sincronización cloud LWW | [sentinel.js](../js/cloud/sentinel.js) L348-412, L433-475 |
| Precache y estrategia offline | [sw.js](../sw.js) L95-141 |
| Catálogo de la tienda (181 ítems) | [shop.json](../data/shop.json), [shop-logic.js](../js/shop-logic.js) |

### P2 — experiencia
Router SPA ([spa-router.js](../js/spa-router.js)); avatar con compresión a 200×200 y subida opcional ([avatar.js](../js/domain/avatar.js) `compressImage` L38, `setAvatar` L108); temas (`deriveThemeRoles` L7 y `setTheme` L73 en [theming.js](../js/domain/theming.js)); identidad ([identity.js](../js/domain/identity.js)); ciclo de vida de Rive ([streak-hub.js](../js/ui/streak-hub.js)); telemetría ([report.js](../api/report.js)); scheduler ([lifecycle-scheduler.js](../js/lifecycle-scheduler.js)).

### P3 — cosmético
Hápticos ([micro-interactions.js](../js/ui/micro-interactions.js)), partículas ([hud-render.js](../js/ui/hud-render.js) L15-33), banner de actualización del SW ([sw-update-bridge.js](../js/pwa/sw-update-bridge.js)).

## 3. Superficie de riesgo

Son hipótesis con evidencia. **No están confirmadas como bugs**: se confirman o se descartan con tests en las fases 2-5.

| ID | Riesgo | Evidencia |
|---|---|---|
| R1 | `completeLevel` no valida `rewardAmount` (negativo, NaN o string → `coins += "5"` concatenaría), a diferencia de `addCoins` | [game-center.js](../js/domain/game-center.js) L20, [game-bridge-runtime.js](../js/game-bridge-runtime.js) L17 |
| R2 | Las dos copias de `completeLevel` pueden divergir | ídem |
| R3 | `importSave` acepta payloads sin `checksum` (rama legacy `data = payload`), así que cualquier JSON con `coins` numérico se importa | [game-center.js](../js/domain/game-center.js) L51-55 |
| R4 | La importación `.labak` escribe cualquier clave sin lista blanca; el checksum no lleva salt (solo detecta corrupción, no manipulación) | [backup-engine.js](../js/backup-engine.js) L190-217 |
| R5 | Sin caché de tiempo verificada se usa `Date.now()` y el reclamo se permite (ventana de manipulación offline) | [time-sync.js](../js/core/time-sync.js) L72-74, [daily-streak.js](../js/domain/daily-streak.js) L27 |
| R6 | Cuota de `localStorage`: el guardado depende de `emergencyCleanup`; si el reintento falla, se borra el historial y no se guarda | [state-store.js](../js/core/state-store.js) L146-163 |
| R7 | LWW depende del reloj local (`love_arcade_sentinel_ts`); con relojes desfasados se pueden perder datos entre dispositivos | [sentinel.js](../js/cloud/sentinel.js) L399-407, L436 |
| R8 | El SW hace cache-first de **todo** GET del mismo origen, incluido `/api/client-config` y respuestas no-OK (las cachea sin comprobar `response.ok`) | [sw.js](../sw.js) L132-141 |
| R9 | Precache atómico: un 404 en la lista hace fallar toda la instalación | [sw.js](../sw.js) L100 |
| R10 | `document.write` en el bridge falla si un juego carga el bridge con `defer`, `async` o como módulo | [game-bridge.js](../js/game-bridge.js) L31-34 |
| R11 | Los códigos promocionales están **en texto plano en comentarios** junto a sus hashes: el hash no protege nada | [promo-codes.js](../js/domain/promo-codes.js) (tabla `PROMO_CODES_HASHED`) |
| R12 | `buyItem` confía en el `price` que le pasa el llamador (los juegos pueden pasar cualquier precio) | [economy.js](../js/domain/economy.js) L12-14 |

R11 es un hallazgo de seguridad que no se puede cubrir con tests de comportamiento. Lo dejo anotado para decisión humana.

## 4. Auditoría de tests existentes

Ejecución real con Node v26.4.0 en este entorno (sesión 1).

### `tests/`
| Archivo | Resultado | Veredicto | Motivo |
|---|---|---|---|
| domain/economy.test.mjs | pasa | Conservar y ampliar | Comportamiento real vía `node:vm`. Solo cubre `buyItem` (11 asserts); faltan `spendCoins` y `addCoins` |
| domain/daily-streak.test.mjs | pasa | Conservar | Reloj simulado; cubre reclamo y reparación |
| domain/promo-codes.test.mjs | pasa | Conservar | Válido, duplicado, inválido |
| domain/avatar.test.mjs | pasa | Conservar | Fallbacks local y cloud |
| domain/game-center.test.mjs | pasa | Modificar | Solo comprueba que existen las claves de la API (5 asserts); no prueba comportamiento |
| service-worker-precache.test.mjs | pasa | Conservar | Install con `addAll` sin duplicados |
| shop-catalog-static-qa.mjs | pasa | Conservar | Valida el esquema real del catálogo publicado |
| interactive-haptics-static-qa.mjs | pasa | Modificar | Regex sobre el código fuente |
| player-hud-static-qa.mjs | pasa | Modificar o eliminar | Regex sobre CSS: aporta poco y es frágil |
| game-bridge.test.mjs | **falla** | Modificar | La parte del bridge es valiosa; falla por un `CACHE_VERSION` literal (`v2.04.07.58` frente a `v2.04.07.65`) |
| rive-streak-lifecycle.test.mjs | **falla** | Modificar | El mock de ciclo de vida es útil; falla por una regex sobre el literal `'State Machine 1'`, que ahora está en la constante `STATE_MACHINE` |
| daily-streak-hub-qa.mjs | **falla** | Modificar (recortar) | Falla en L12 (comentario de atribución en el HTML). Las aserciones de accesibilidad L7-11 (`button`, `role="status"`, `aria-live`) tienen valor; las de CSS literal no. Las aserciones posteriores a L12 no llegan a ejecutarse |
| documentation-static-qa.mjs | **falla** | Conservar; ajustar exclusiones | Detecta términos legacy dentro de `daily-streak-hub-qa.mjs` (aserciones negativas) y valida enlaces de los `.md` |

### `games/jigsaw/test/` (20 archivos)
- 14 tests unitarios pasan. **Conservar.**
- `phase4/5/6_smoke_playwright.js`: fallan con `MODULE_NOT_FOUND` (no hay playwright). `phase7_smoke_playwright.js` se salta solo si falta playwright. **Conservar, fuera de la suite local.**
- `phase14_victory_redesign_unit.mjs`: falla porque exige `../../js/app.js` en el HTML del juego, cuando la arquitectura vigente lo prohíbe (game-bridge.test L67). **Modificar.**
- `phase7_unit.mjs`: la lógica es correcta, pero falla por el umbral `elapsedMs < 20000` (aquí tardó ~56 s en ARM). **Modificar** (umbral dependiente del hardware).

No hay un comando único que ejecute todo: cada test es un script suelto.

## 5. Entorno (verificado)

| Recurso | Estado |
|---|---|
| SO / CPU | Android Termux, `aarch64`, kernel 4.14 |
| Node / npm | v26.4.0 / 11.20.0; `node --test` operativo |
| APIs de Node útiles | `crypto.subtle`, `CompressionStream` y `structuredClone` disponibles (permiten probar sync-worker y backup-engine sin navegador) |
| Python | 3.14.6 (`http.server` disponible como servidor estático) |
| Red / registro npm | accesible (`npm view playwright version` → 1.64.0) |
| Navegadores | ninguno (`chromium`, `chrome` y `playwright` ausentes). Playwright no publica binarios para Android/Termux |
| `package.json` | no existe |

**Se puede ejecutar aquí**: tests unitarios y de integración en Node (`node:test`, `node:vm`), handlers serverless importados directamente, lógica del SW en un sandbox `vm`, validaciones estáticas y verificación por mutación.
**No se puede ejecutar aquí**: E2E con navegador real, render de Canvas/Rive/WebGL, Service Worker real, auditorías de accesibilidad con DOM renderizado.
