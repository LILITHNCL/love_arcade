# Índice de Fase 2a — Persistencia Core

- [TKT-001-store-carga-migracion](TKT-001-store-carga-migracion.md) (P0)
- [TKT-002-store-save-cuota](TKT-002-store-save-cuota.md) (P0)
- [TKT-003-historial](TKT-003-historial.md) (P1)


## Revisión adversarial real
1. **Puntos ciegos de TKT-001**: El test verifica que un JSON corrupto cargue defaults, pero asume que `JSON.parse` fallará y tirará catch. Si el payload es `null` o `"string"`, `JSON.parse` no falla, pero luego iterarlo como objeto puede fallar. En `state-store.js`, `merged = {...defaults, ...loadedStore}` fusiona. Si `loadedStore` es primitivo, es ignorado y se usa `defaults`. Funciona bien, pero no está explícitamente en el test.
2. **Puntos ciegos de TKT-002**: El mock de `QuotaExceededError` es síncrono. En algunos navegadores viejos el error podría llamarse `NS_ERROR_DOM_QUOTA_REACHED`. El código real solo chequea `error?.name !== 'QuotaExceededError'`. Si un navegador lanza otra cosa, el fallback no entra. Esto debería probarse en F5. 
3. **Mocks que ocultan problemas**: El mock de `localStorage` asume sincronicidad y no refleja los límites reales del navegador (~5MB). La lógica del store chequea la longitud del string `> 4000 KB`. En memoria, el mock acepta cualquier tamaño, por lo que el test asume que el store controla la lógica, lo cual es correcto, pero el browser real es el único que puede validar el comportamiento frente al OOM real (Out Of Memory).
4. **Matriz 1, 2 y 6**: Cubiertos exitosamente. El R6 demostró ser un bug real que vacía el historial silenciosamente (Bug-F2a-01).
