# Huecos de Cobertura (Puntos ciegos detectados)

## F2a - Persistencia Core
- **Compatibilidad de Navegadores con QuotaExceededError**: Diferentes navegadores lanzan errores con distintos nombres para la cuota de disco (`NS_ERROR_DOM_QUOTA_REACHED` y code 1014 sin cubrir -> F5). El código real comprueba solo error.name === 'QuotaExceededError'. F5 debería testear fallos con otros nombres de error de cuota.
- **Multitaba (Multipestaña)**: En `history.js`, si hay múltiples pestañas abiertas, hacer push a `store.history` no sincroniza con los eventos de otras pestañas simultáneas hasta un refresh. F5 (multipestaña) debería abordarlo.
- **JSON mal formado pero no un objeto**: Si `localStorage` tiene `"string"` o `true` en lugar de objeto JSON, `JSON.parse` no lanza error. La lógica actual lo maneja indirectamente al fusionar `{...defaults, ...loadedStore}` (ignora primitivos), pero faltan tests explícitos con arreglos (que son objetos pero de tipo Array) en la raíz del store.
