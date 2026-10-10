# TKT-011: Códigos Promocionales

**Fase**: F2d
**Matriz de cobertura**: #11
**Prioridad**: P1

## Objetivo
Ampliar los tests existentes de `js/domain/promo-codes.js` (`redeemPromoCode`) para asegurar robustez, usando la implementación real de SHA-256 (`crypto.subtle`).

## Criterios de aceptación
- Normalización: "  codigo  " y "cOdiGO" deben tratarse igual (espacios eliminados, mayúsculas).
- Reutilización: Un código ya canjeado no puede volver a usarse (incluyendo variaciones de mayúsculas/espacios).
- Entradas inválidas (vacío, null, undefined, número, no-string) deben devolver `success: false` sin mutar saldo ni historial.
- El canje exitoso suma recompensa e inserta el evento en el historial.
- Debe usarse el hash SHA-256 real (mediante `js/core/utils.js`), sin mockear.
- R11: Los hashes en texto plano ya están documentados en `01-diagnostico.md`, no requiere tests.

## Tareas
- [x] Inyectar `crypto` y `TextEncoder` en el sandbox de tests.
- [x] Reescribir `tests/domain/promo-codes.test.mjs` para usar `js/core/utils.js` (sha256 real).
- [x] Añadir aserciones de normalización de espacios y mayúsculas.
- [x] Añadir aserciones para entradas inválidas.
- [x] Ejecutar tests.
- [x] Mutación 1: Quitar normalización.
- [x] Mutación 2: Quitar validación de reutilización.
- [x] Verificar fallos de mutación.
