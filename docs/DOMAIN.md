# Dominio de negocio actual

## Propósito

Este documento es la fuente normativa para la economía y el estado persistido de Love Arcade. Resume reglas verificadas en el código actual y marca explícitamente qué se considera hecho, inferido o pendiente de revisión humana.

## Principio de evidencia

- Hecho verificado: se confirma en el código actual y/o en la configuración persistida del repositorio.
- Inferencia: se desprende del diseño actual, pero no tiene un test específico que la valide en aislamiento.
- Revisión humana: requiere inspección adicional antes de declararlo como contrato definitivo.

## 1. Estado persistido y autoridad económica

Evidencia: `js/core/config.js` define `CONFIG.stateKey = 'gamecenter_v6_promos'` y `js/app.js` define `window.GameCenter` como la API pública del dominio.

La fuente de verdad económica principal es `store` del navegador, guardado en `localStorage` bajo la clave `gamecenter_v6_promos`.

Reglas verificadas:

- `store.coins` representa el saldo actual del usuario.
- `store.inventory` representa el inventario del usuario.
- `store.history` registra transacciones de ingreso, gasto y reparación.
- `store.daily` registra `lastClaim` y `streak`.
- `store.buffs.moonBlessingExpiry` representa la vigencia de la Bendición Lunar.
- `store.redeemedHashes` registra códigos promocionales ya canjeados.

La autoridad económica del negocio y del flujo comercial está en `window.GameCenter`, no en una capa auxiliar distinta. La tienda y la interfaz delegan la decisión final a `GameCenter.buyItem()`, `redeemPromoCode()`, `claimDaily()`, `buyMoonBlessing()` y `repairDailyStreak()`.

## 2. Economía: descuento, cashback y precios finales

Evidencia: `const ECONOMY = { isSaleActive: false, saleMultiplier: 0.80, saleLabel: '-20%', cashbackRate: 0.1 }` en `js/core/config.js`; `buyItem()` aplica la fórmula exacta en `window.GameCenter.buyItem(itemData)`.

### Fórmula vigente

- Si `ECONOMY.isSaleActive` es `true`, el precio final se calcula con:
  `Math.floor(itemData.price * ECONOMY.saleMultiplier)`.
- El cashback se calcula con:
  `Math.floor(finalPrice * ECONOMY.cashbackRate)`.
- La compra neta resta el precio final y suma el cashback al saldo.

### Regla de negocio actual

- La oferta es un descuento global del catálogo, no un sistema económico independiente.
- El cashback es una devolución automática del saldo tras la compra.
- El descuento visible y el cashback son señales de UI, pero la autoridad real sigue estando en `GameCenter.buyItem()`.

### Ejemplo de cálculo

Si el precio base es `1000` y la oferta es `-20%`:

- `finalPrice = Math.floor(1000 * 0.80) = 800`
- `cashback = Math.floor(800 * 0.10) = 80`
- neto de compra: `-800` y luego `+80` de cashback; el saldo final baja en `720` respecto al precio base.

Para el procedimiento operativo de activar/ajustar ofertas y cashback, ver [docs/ECONOMIA.md](./ECONOMIA.md).

## 3. Inventario, colección y catálogo

Evidencia: `js/shop-logic.js` y `js/app.js` usan `store.inventory` y el catálogo de `data/shop.json` como fuente de productos; la tienda muestra artículos no poseídos y la colección muestra poseídos.

Reglas verificadas:

- El catálogo publicado del producto vive en `data/shop.json`.
- La compra requiere una validación previa del inventario y disponibilidad de saldo.
- Los IDs del inventario son estables y no deben reutilizarse.
- La Colección se monta bajo demanda y no es una búsqueda global de la Tienda.
- La búsqueda de la tienda se mantiene localizada en la Colección; la búsqueda global no es una autoridad comercial.

## 4. Códigos promocionales

Evidencia: `const PROMO_CODES_HASHED = { ... }` en `js/core/config.js`; `GameCenter.redeemPromoCode()` aplica `sha256()` antes de comparar.

Reglas verificadas:

- Los códigos promocionales no se almacenan en texto plano.
- El valor introducido se normaliza a mayúsculas y se hashea con SHA-256 antes de buscar coincidencia.
- Si el hash ya existe en `store.redeemedHashes`, el código se rechaza como duplicado.
- Cuando es válido, se añade el premio al saldo y se registra en `store.history`.

## 5. Racha diaria

Evidencia: `window.GameCenter.claimDaily()`, `canClaimDaily()`, `getStreakInfo()`, `repairDailyStreak()` en `js/app.js`; `CONFIG.dailyReward`, `CONFIG.dailyStreakCap`, `CONFIG.dailyStreakStep` en `js/core/config.js`.

### Fórmula de recompensa

`baseReward = min(CONFIG.dailyReward + (newStreak - 1) * CONFIG.dailyStreakStep, CONFIG.dailyStreakCap)`.

Con valores actuales:

- `dailyReward = 20`
- `dailyStreakCap = 60`
- `dailyStreakStep = 5`

Esto produce recompensas base de 20, 25, 30, 35, 40, 45, 50, 55, 60, etc.

### Reglas de continuidad y ruptura

El cálculo usa días calendario normalizados y compara `lastClaim` con el tiempo actual según el mismo esquema que `claimDaily()`:

- `diffDays === 0`: ya se reclamó hoy; no se concede recompensa.
- `diffDays === 1`: la racha continua; aumenta en 1.
- `diffDays === 2`: la racha está en reparación posible; el flujo devuelve `repairRequired` y exige `DAILY_REPAIR_COST`.
- `diffDays > 2`: la racha se rompe y se reinicia a `1`.

El valor `store.daily.lastClaim` se actualiza solo cuando el reclamo tiene éxito; si el reloj local parece inconsistente, `claimDaily()` bloquea el reclamo y devuelve un mensaje de error.

### Reparación de racha

Evidencia: `GameCenter.repairDailyStreak()` en `js/app.js` y `DAILY_REPAIR_COST = 500`.

Si hay una ruptura de 2 días, la UI puede ofrecer reparación por 500 monedas. La reparación:

- valida `lastClaim` y caché de tiempo;
- requiere que el estado actual permita reparación;
- descuenta `500` monedas;
- actualiza `store.daily.lastClaim` sin reincia la racha.

### Reloj y seguridad

Evidencia: `_readTimeCache()`, `_getDailyDiffDays()`, `CLOCK_SKEW_LIMIT`, `TIME_CACHE_TTL`, y la validación de `desynced` en `claimDaily()`.

- El sistema usa un caché sincronizado en `localStorage` para evaluar la validez del día.
- Si el reloj se detecta desincronizado, el reclamo se bloquea.
- Si `lastClaim > now`, el sistema bloquea el reclamo por inconsistencia horaria.

Para un análisis extendido (UX, accesibilidad, motion, riesgos y diagrama de flujo), ver
[docs/sistema-racha-diaria.md](./sistema-racha-diaria.md).

## 6. Bendición Lunar como modificador de recompensa

Evidencia: `GameCenter.buyMoonBlessing()`, `extendMoonBlessingDays()`, `getMoonBlessingStatus()` y la lógica dentro de `GameCenter.claimDaily()` en `js/app.js`.

La Bendición Lunar no es una racha por sí misma; es un modificador de recompensa del bono diario.

Reglas verificadas:

- Coste de activación: `100` monedas.
- Duración: `7` días.
- Efecto por reclamo: `+90` monedas.
- La lógica se aplica dentro de `claimDaily()` cuando `store.buffs.moonBlessingExpiry > now`.
- Si el buff está activo, el total del premio diario se calcula como `baseReward + 90`.

Debe documentarse como una mejora de recompensa, no como una segunda racha o un sistema paralelo de progreso diario.

## 7. Identidad, perfil y temas

Evidencia: `const THEMES = { ... }` y `window.THEMES = THEMES` en `js/core/config.js`; `index.html` y `styles.css` leen esa estructura para el selector visual del usuario.

Reglas verificadas:

- Existen 25 temas en la estructura actual de `THEMES`.
- Cada clave tiene un `accent` y un `name`.
- El tema persistido forma parte del estado principal del usuario.
- Los minijuegos reciben acceso a la identidad visual de la plataforma a través de `window.THEMES` y el `accent` del tema activo.

Revisión humana:

- Las decisiones sobre generación de tokens visuales, duplicación de paletas y la relación exacta entre `index.html` y `app.js` requieren comprobación adicional antes de tratar esas secciones como contrato formal de diseño.

## 8. Historial y transacciones

Evidencia: `GameCenter.getHistory()` y los `logTransaction()` emitidos en `js/app.js`.

El historial documenta:

- compras;
- cashback;
- bonos diarios;
- reparación de racha;
- canjes de códigos promocionales;
- activación de Bendición Lunar.

Su propósito es de auditoría económica y no de fuente primaria del dominio; la autoridad real sigue siendo `store` y `GameCenter`.

## 9. Inferencias de diseño y límites

Inferencias apoyadas por código actual:

- La aplicación es local-first: la capa principal de negocio y persistencia vive en `localStorage`.
- La nube y el servidor son opcionales: la app sigue operando si faltan variables o endpoints de sincronización.
- `GameCenter` concentra la lógica de dominio y la UI evita mutar el estado directamente.

## 10. No confirmado / revisión humana

Los siguientes puntos no deben tratarse como contrato definitivo sin comprobación adicional:

- detalles de próximos tokens visuales o generación dinámica de temas;
- relación exacta exacta entre `index.html` y `window.THEMES` para una migración de diseño no documentada;
- cualquier afirmación sobre ambient del HUD o patrones de movimiento que no estén confirmados en `styles.css` y `index.html`.

## 11. Referencias cruzadas

- [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/INTEGRATION.md](./INTEGRATION.md)
- [docs/OPERATIONS.md](./OPERATIONS.md)
- [docs/DOCUMENTATION_POLICY.md](./DOCUMENTATION_POLICY.md)
- [README.md](../README.md)
