# Guía breve JSDoc — Love Arcade

## Objetivo
Documentar **decisiones de diseño** en funciones críticas (estado, navegación, render, red y permisos), evitando comentarios línea por línea.

## Plantilla obligatoria (funciones críticas)
```js
/**
 * <Propósito en 1 frase orientada a negocio/UX>.
 *
 * Precondiciones: <supuestos de entrada, DOM o entorno>.
 * Efectos secundarios: <DOM/storage/red/timers/workers si aplica>.
 * Coste esperado: <O(n), nº de requests, o coste aproximado por frame/tick>.
 * Diseño (por qué): <tradeoff y razón técnica/UX detrás de la estrategia>.
 */
function ejemploCritico(...) {}
```

## Criterios del proyecto
- Priorizar módulos de dominio con reglas y persistencia: `js/core/state-store.js`, `js/domain/economy.js`, `js/domain/daily-streak.js`, `js/domain/promo-codes.js`, `js/domain/avatar.js` y `js/domain/game-center.js`; mantener también cobertura en los orquestadores `js/spa-router.js` y `js/shop-logic.js`.
- Explicar **por qué** se eligió la estrategia (p. ej. `requestAnimationFrame`, listeners de ciclo de vida, debounce/throttle, fallbacks).
- Evitar “narra cada línea”; documentar límites, contratos y riesgos mitigados.
- Si una función toca varias capas, declarar explícitamente impacto en:
  - DOM
  - Storage (`localStorage`, `sessionStorage`)
  - Red (`fetch`, SW, Supabase)

## Checklist anti-regresión documental (antes de merge)
- [ ] ¿La función crítica nueva/modificada tiene plantilla completa?
- [ ] ¿Incluye motivo de diseño (no solo comportamiento)?
- [ ] ¿Se declararon efectos secundarios reales?
- [ ] ¿El coste esperado es coherente con la implementación?
