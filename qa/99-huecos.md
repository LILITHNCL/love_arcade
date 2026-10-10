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
