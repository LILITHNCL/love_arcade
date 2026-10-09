# 00 — Plan maestro de testing

Memoria entre sesiones. Al empezar cada sesión: leer este archivo y solo los documentos que la fase necesite.
Documentos: [01-diagnostico](01-diagnostico.md) · [02-estrategia](02-estrategia.md) · [03-matriz-cobertura](03-matriz-cobertura.md) · [ESTRATEGIA-AGENTE](ESTRATEGIA-AGENTE.md)

## Estado

**Plan confirmado y actualizado.** No hay tickets ni tests nuevos.

## Fases

Cada fase cabe en una sesión. Cada fase va en su propia branch `pruebas-fase-N-<tema>` y no se avanza a la siguiente sin tu confirmación.

| Fase | Objetivo | Matriz # | Ejecutable aquí | Estado |
|---|---|---|---|---|
| **F1 Infraestructura** | `package.json` mínimo; runner `node --test` unificado; reparar/recortar tests rotos. Salida: `npm test` en verde | 27 | Sí | pendiente |
| **F2a Riesgo alto: economía y store** | migrate/save/cuota, buy/spend/add, `completeLevel` (paridad hub↔bridge), historial | 1-6 | Sí | pendiente |
| **F2b Riesgo alto: tiempo, racha y partida** | día lógico, caché de tiempo, racha y reparación, Luna, promo, export/import | 7-12 | Sí | pendiente |
| **F3a Integración: cloud y backup** | interceptor y LWW de Sentinel con Supabase falso; backup `.labak` con gzip y crypto reales | 13-15 | Sí | pendiente |
| **F3b Integración: bridge, SW y API** | contrato del bridge; precache existente; estrategias de fetch; handlers de `api/` | 16-20 | Sí | pendiente |
| **F5 Edge cases** | corrupción, multipestaña, almacenamiento al límite, unicode, saltos de reloj transversales | 26 | Sí | pendiente |
| **F6 Regresión** | contrato público de `GameCenter`; consolidar lista de `todo`; documentación de la suite | 28 | Sí | pendiente |
| **F4 E2E críticos** | Playwright: ≤ 7 flujos (racha, compra, nivel, promo, export/import, navegación) | 21-25 | **No** (los ejecuta el usuario en su máquina) | pendiente |
| **F7 Accesibilidad (condicional)** | axe + foco en diálogos y formularios. Performance: descartada | 29 | **No** | por decidir |

Orden de fases: F1 → F2a → F2b → F3a → F3b → F5 → F6 → F4 → F7.

## Tareas pendientes documentadas para F1 (Tests existentes rotos)

Tests que fallan actualmente con `npm test` y deben corregirse o recortarse en F1:
- `tests/documentation-static-qa.mjs`: Falla al encontrar "streak-flame" en `tests/daily-streak-hub-qa.mjs`. Causa: Busca ausencias de referencias antiguas y falla al verlas en el código de QA. Test frágil.
- `tests/game-bridge.test.mjs`: Falla aserción sobre `CACHE_VERSION`. Causa: La versión de caché ha cambiado en `sw.js`. Test frágil acoplado a la implementación.
- `tests/rive-streak-lifecycle.test.mjs`: Falla aserción sobre nombre estático de `stateMachine`. Causa: El código de producción usa la constante `STATE_MACHINE`. Test frágil acoplado a la implementación.

## Cobertura ya existente (verificada)
Los siguientes comportamientos ya están cubiertos por tests existentes y no deben generar tareas duplicadas en las fases:
- **Matriz #9 (Racha diaria y reparación)**: Cubierto y ampliable en `tests/domain/daily-streak.test.mjs`.
- **Matriz #11 (Promo codes)**: Cubierto en `tests/domain/promo-codes.test.mjs`.
- **Matriz #16 (Bridge en cada juego)**: Cubierto en `tests/game-bridge.test.mjs`.
- **Matriz #17 (SW: precache, sin duplicados)**: Cubierto en `tests/service-worker-precache.test.mjs`.
- **Matriz #28 (Contrato público GameCenter)**: Cubierto en `tests/domain/game-center.test.mjs`.
- **Ciclo de vida StreakHub (init/destroy/stateMachine)**: Cubierto en `tests/rive-streak-lifecycle.test.mjs`.

## Bugs y hallazgos reclasificados (tests de QA)
- **Bug F1 (atribución CC BY)**: "aristote" solo aparece en archivos y tests. Pendiente de decisión del usuario. Añadido como `todo` en `tests/daily-streak-hub-qa.mjs`.
- **Bug F3 (vh vs dvh)**: Reclasificado como mejora progresiva (no es bug). Aserción eliminada.
- **Bug F4 (opacidad glow)**: Hallazgo de diseño pendiente de decisión del usuario. Añadido como `todo` en `tests/daily-streak-hub-qa.mjs`.
- **Seguridad**: Códigos promocionales expuestos en texto plano, reportados sin modificar código.

## Decisiones de la estrategia

1. **Gestión de ramas**: No se encadenan branches. Cada fase sale de `origin/main` y se fusiona con *Squash and merge* antes de la siguiente.
2. **Stack**: Nativo de Node (`node:test`, `node:assert`, `node:vm`, `crypto.subtle`, `CompressionStream`) sin dependencias. Playwright entra solo en F4 como devDependency. `package.json` es mínimo, usando `node --test "tests/**/*.mjs"`, sin dependencias y sin `"type": "module"`.
3. **Producción**: El código de producción se carga tal cual vía `vm` en el orden de `index.html`. No se modifica para testear.
4. **Mocks**: Se mockea solo la frontera (localStorage, reloj, red, Supabase, `res`, caches).
5. **Bugs encontrados**: Si un test revela un bug real (como R1-R12), se documenta en `/qa/BUGS-ENCONTRADOS.md`, se marca el test con `todo` en `node:test` y NO se corrige.
