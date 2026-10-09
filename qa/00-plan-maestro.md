# 00 — Plan maestro de testing

Memoria entre sesiones. Al empezar cada sesión: leer este archivo y solo los documentos que la fase necesite.
Documentos: [01-diagnostico](01-diagnostico.md) · [02-estrategia](02-estrategia.md) · [03-matriz-cobertura](03-matriz-cobertura.md) · [ESTRATEGIA-AGENTE](ESTRATEGIA-AGENTE.md)

## Estado

**Plan confirmado y actualizado.** No hay tickets ni tests nuevos.

## Fases

Cada fase cabe en una sesión. Cada fase va en su propia branch `pruebas-fase-N-<tema>` y no se avanza a la siguiente sin tu confirmación.

| Fase | Objetivo | Matriz # | Ejecutable aquí | Estado |
|---|---|---|---|---|
| **F1 Infraestructura** | `package.json` mínimo; helpers compartidos; runner `node --test` unificado; reparar o recortar los tests rotos según auditoría. **Salida: `npm test` en verde.** | 27 | Sí | pendiente |
| **F2a Riesgo alto: economía y store** | migrate/save/cuota, buy/spend/add, `completeLevel` (paridad hub↔bridge), historial | 1-6 | Sí | pendiente |
| **F2b Riesgo alto: tiempo, racha y partida** | día lógico, caché de tiempo, racha y reparación, Luna, promo, export/import | 7-12 | Sí | pendiente |
| **F3a Integración: cloud y backup** | interceptor y LWW de Sentinel con Supabase falso; backup `.labak` con gzip y crypto reales | 13-15 | Sí | pendiente |
| **F3b Integración: bridge, SW y API** | contrato del bridge en los 8 juegos; precache existente en disco; estrategias de fetch; handlers de `api/` | 16-20 | Sí | pendiente |
| **F5 Edge cases** | corrupción, multipestaña, almacenamiento al límite, unicode, saltos de reloj transversales | 26 | Sí | pendiente |
| **F6 Regresión** | contrato público de `GameCenter`; revisión de la lista de `todo`; consolidar comandos y documentación de la suite | 28 | Sí | pendiente |
| **F4 E2E críticos** | Playwright: ≤ 7 flujos (racha, compra, nivel vía bridge, promo, export/import, navegación) | 21-25 | **No**: se escriben aquí y los verificas tú (`VERIFICACION-HUMANA-FASE-4.md`) | pendiente |
| **F7 Accesibilidad (condicional)** | axe + foco en diálogos y formularios. **Performance: descartada** (ver 02 §1) | 29 | **No** | por decidir al cerrar F4 |

Orden de dependencias: F1 → F2a → F2b → F3a → F3b → F5 → F6 → F4 → F7. Las branches saldrán desde `origin/main` (sin encadenar).

## Decisiones clave

1. El stack es nativo de Node (`node:test`, `node:assert`, `node:vm`, `crypto.subtle`, `CompressionStream`) sin dependencias. Playwright entra solo en F4 como devDependency. Justificación en [02 §2](02-estrategia.md).
2. El código de producción se carga tal cual vía `vm` en el orden de `index.html`. No se modifica para testear.
3. Se mockea solo la frontera: localStorage, reloj, red, Supabase, `res`, caches. Cada mock se anota en su ticket.
4. Los riesgos R1-R12 son hipótesis. Si un test confirma alguno, se documenta en `BUGS-ENCONTRADOS.md`, se marca el test con `todo` y no se corrige.
5. Sin umbrales de tiempo ni regex sobre CSS o comentarios.
6. No se encadenan branches, cada fase parte de `origin/main`.
7. `package.json` mínimo creado sin dependencias ni type module.
8. Se han diagnosticado los fallos en tests existentes y los bugs reales documentados en `/qa/BUGS-ENCONTRADOS.md`. Las aserciones frágiles o acopladas a la implementación fueron recortadas.

