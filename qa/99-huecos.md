# Huecos de Cobertura (Puntos ciegos detectados)

## F2a - Persistencia Core
- **Compatibilidad de Navegadores con QuotaExceededError**: Diferentes navegadores lanzan errores con distintos nombres para la cuota de disco (`NS_ERROR_DOM_QUOTA_REACHED` y code 1014 sin cubrir -> F5). El código real comprueba solo error.name === 'QuotaExceededError'. F5 debería testear fallos con otros nombres de error de cuota.
- **Multitaba (Multipestaña)**: En `history.js`, si hay múltiples pestañas abiertas, hacer push a `store.history` no sincroniza con los eventos de otras pestañas simultáneas hasta un refresh. F5 (multipestaña) debería abordarlo.
- **JSON mal formado pero no un objeto**: Si `localStorage` tiene `"string"` o `true` en lugar de objeto JSON, `JSON.parse` no lanza error. La lógica actual lo maneja indirectamente al fusionar `{...defaults, ...loadedStore}` (ignora primitivos), pero faltan tests explícitos con arreglos (que son objetos pero de tipo Array) en la raíz del store.

## F2b - Economía y Recompensas
- **Sincronización silenciosa en `Economy`:** `Economy.buyItem`, `spendCoins` y `addCoins` llaman a `Store.save({ immediateCloudSync: true })`. Los tests actuales verifican la mutación local, pero el mock de `Store.save` no comprueba que el flag de sincronización esté activado; si alguien quita el flag y deja el guardado, los tests unitarios seguirán en verde pero las monedas no se sincronizarán en la nube al instante.
- **Historial asíncrono:** `getHistory` no se invoca en los tests exhaustivos de economía (solo se lee directamente `Store.getStore().history`). Si la función `getHistory` mutara o invirtiera mal el array (ej. usando `.reverse()` que muta in-place), estos tests no lo detectarían.
- **`localStorage` (Cuota):** En los tests de F2b falseamos el `localStorage` sin límites. En la vida real, una compra (`buyItem`) podría disparar un `QuotaExceededError` al guardar en localStorage (al límite de 5MB). El test actual no prueba qué pasa si `Store.save` lanza excepción dentro de `buyItem`.
- **`Date.now()`:** Falseado en el test de paridad para igualar el historial. Esto oculta que las implementaciones de bridge y hub corren en contextos de tiempo y frames distintos, lo que en persistencia real a la misma clave podría generar colisiones de estado.
- **Concurrencia:** Posible corrupción si el bridge envía recompensas y el Sentinel sincroniza simultáneamente con un update LWW (Last-Write-Wins).

## F2c - Tiempo y Racha
- **Confiabilidad de Date.now fallback (BUG-F2c-01):** Sin caché (o si es borrado por el usuario) se confía en `Date.now()` para el cálculo, lo cual facilita exploits modificando la hora local offline.
- **Doble carga por latencia de UI:** `claimDaily` es síncrono sobre memoria/caché; si la UI llamara dos veces el evento click muy rápido en el mismo milisegundo antes de actualizar el DOM, solo se registraría un reclamo gracias a que muta sincrónicamente `Store.getStore().daily`. Sin embargo, si `claimDaily` o el guardado de `Store.save()` fuesen asíncronos y no hubiera debounce UI, se podría reclamar dos veces (actualmente seguro por sincronía, pero frágil a futuro).
- **Fallos silenciosos en caché:** El `try/catch` de `_writeTimeCache` esconde excepciones de tipo `QuotaExceededError`. Faltan tests para asegurar que esto es seguro bajo límite de cuota sin corromper.
