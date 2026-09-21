# Contrato de integración de minijuegos

## Propósito

Este documento es la referencia actual para integradores de minijuegos dentro de Love Arcade. Define el contrato público que el hub usa para recompensar, persistir y mantener una identidad visual compartida sin duplicar la economía del proyecto central.

## Estado del documento

- Hecho verificado: los minijuegos viven bajo `games/` y cada uno tiene un `index.html` propio.
- Hecho verificado: `js/domain/game-center.js` ensambla `window.GameCenter` como API pública de dominio, sin cambiar el contrato para minijuegos.
- Hecho verificado: `window.GameCenter.completeLevel(gameId, levelId, rewardAmount)` es la forma actual de registrar recompensas del juego.
- Inferencia: la arquitectura del proyecto asume juegos autónomos con persistencia local propia y con retorno al hub desde el navegador.
- No confirmado: cualquier contrato adicional que no aparezca explícitamente en el código actual debe mantenerse en cada README del juego y revisarse localmente.

## 1. Patrón de integración

Los minijuegos se alojan en la carpeta `games/` y siguen un patrón de subaplicación independiente:

- tienen un `index.html` propio;
- encapsulan su lógica y assets en su carpeta local;
- pueden abrirse desde el navegador sin depender de un bundler del proyecto central;
- tienen una salida o retorno al hub principal;
- usan `window.GameCenter` para registrar resultados con impacto económico.

La lógica global de autenticación, economía, persistencia y rewards del hub no debe duplicarse en el juego.

## 2. Entrypoint y bootstrap

Cada juego debe tener un entrypoint HTML local. No se exige una compilación central ni un arranque dependiente de un entorno especial dentro del proyecto raíz.

La disciplina del repositorio es atender cada juego como una miniaplicación independiente, con su propio flujo de render, input y assets, pero compartiendo el mismo patrón base de navegador estático.

### Único entrypoint de integración con el hub

`../../js/game-bridge.js` es el **único** entrypoint de integración admitido para documentos bajo `games/`. Un juego que consuma recompensas o compatibilidad del hub debe cargarlo **una sola vez**, como script clásico, durante el parseo del documento y **antes** de cualquier script propio que pueda consultar `window.GameCenter`. No usar `type="module"` ni `defer` para el bridge. El bridge carga de manera síncrona y ordenada la configuración, el store, el historial, la economía mínima y la identidad que respaldan el contrato de juego.

No se debe cargar `../../js/app.js` desde `games/`: ese archivo sólo orquesta el bootstrap visual del hub y presupone módulos de UI que una página de juego no carga.

`game-bridge.js` expone los globals de compatibilidad de lectura `window.CONFIG`, `window.ECONOMY` y `window.THEMES`, además de una superficie deliberadamente pequeña de `window.GameCenter`: `completeLevel`, `getBalance`, `getHistory`, `addCoins`, `spendCoins`, `buyItem`, `getIdentity` y `hasIdentity`. No carga UI del hub, Sentinel, `postMessage` ni infraestructura de iframe.

Los juegos son documentos independientes del mismo origen. `completeLevel()` persiste el saldo en `localStorage` bajo `CONFIG.stateKey`; al regresar o recargar la página principal, el hub rehidrata esa misma clave y actualiza su HUD. No existe comunicación por iframe, `postMessage` ni eventos cross-document para acreditar recompensas.

Orden mínimo obligatorio:

```html
<script src="../../js/game-bridge.js"></script>
<script src="./js/game-entry.js"></script>
```

## 3. Contrato actual: `window.GameCenter.completeLevel()`

La firma verificada en el código actual es:

```js
window.GameCenter.completeLevel(gameId, levelId, rewardAmount)
```

### Comportamiento actual

La implementación vigente hace lo siguiente:

- guarda el progreso del juego bajo `store.progress[gameId]`;
- ignora el pago si el `levelId` ya estaba registrado;
- suma `rewardAmount` al saldo global del usuario;
- persiste el estado del hub con sincronización inmediata cuando procede;
- devuelve un objeto con el resultado de la operación, incluyendo `{ paid, coins }`.

La idempotencia es parte del contrato: el mismo `levelId` no debe pagar dos veces para un mismo `gameId`. Por ello, `levelId` debe ser un identificador estable y único del nivel, hito o sesión que se está acreditando; no se debe reutilizar para recompensas distintas.

Ejemplo mínimo:

```js
const result = window.GameCenter.completeLevel(
    'mi-juego',
    'nivel-003-completado',
    125
);

if (result.paid) console.log(`Saldo actualizado: ${result.coins}`);
```

## 4. Formato de la recompensa

La recompensa debe ser un número entero expresado en monedas de Love Arcade.

El juego no debe repartir valores no numéricos ni estados de progreso que el hub no pueda convertir a saldo. La lógica económica del hub es la única autoridad del saldo del usuario.

## 5. Economía global frente a economía local del juego

Los minijuegos pueden tener su economía propia para mecánicas internas, pero eso no sustituye ni replica la autoridad económica global del hub.

Regla combinada con el código actual:

- la economía del proyecto central vive en `window.GameCenter` y `store`;
- el juego debe registrar el resultado final a través del contrato del hub;
- la recompensa global se paga con monedas del hub;
- la subaplicación no debe convertirse en una segunda fuente de verdad del saldo del usuario.

## 6. Persistencia local del juego y aislamiento

Un minijuego puede mantener su propio estado local dentro de su carpeta o en almacenamiento del navegador, siempre que ese estado no se confunda con el estado económico del hub.

El aislamiento recomendable es:

- persistencia del juego local al juego;
- economía del hub centralizada en `store`;
- reingreso al hub sin depender de rehidratar el estado del juego como si fuera la identidad del usuario.

## 7. Modo standalone

Los juegos deben seguir siendo operables si se abren directamente desde su carpeta local dentro de `games/`.

Esto no implica un contrato de runtime especial ni un servidor propio del repositorio. Si el bridge no se incluye, `window.GameCenter` no está disponible: el juego debe degradar de forma segura, conservar únicamente su resultado local y no intentar acreditar monedas del hub. El código actual refleja un modelo estático y navegador-first: cada juego se prueba y se ejecuta de forma autónoma, pero puede integrarse al hub cuando se decide abrirlo desde la aplicación principal.

## 8. Namespacing y globals reservados

Los minijuegos deben evitar colisiones de nombres con el proyecto principal. La integración actual considera relevantes los siguientes globals públicos; los namespaces internos `LoveArcadeTheming`, `LoveArcadeThemeGrid` y `LoveArcadeGameCenter` no son contrato de integración:

- `window.GameCenter`
- `window.THEMES`
- `window.CONFIG` y `window.ECONOMY` cuando se usan por compatibilidad de lectura
- `window.LoveArcadeStore`, `window.LoveArcadeTime` y `window.Sentinel`, reservados para infraestructura del hub
- `window.AppScheduler`, `window.debounce`, `window.formatCoinsNavbar`, `window.revealUI` y `window.workerTask`, reservados para runtime y UI del hub

Se debe evitar reescribir variables globales del hub ni declarar nombres que pudieran reemplazar API pública del proyecto.

### Interceptor de almacenamiento de Sentinel

El hub carga `js/cloud/sentinel.js` antes de los módulos de dominio. Sentinel
aplica un *monkey-patch* global a `localStorage.setItem()` y
`localStorage.removeItem()` para observar únicamente sus claves vigiladas y
programar la sincronización cloud cuando exista sesión. Este efecto es
intencional: los minijuegos deben usar claves con prefijo propio, no sobrescribir
las claves reservadas del hub y no sustituir los métodos de `localStorage`.
Las escrituras en claves no vigiladas conservan el comportamiento nativo y no
generan una sincronización cloud.

## 9. Contrato de temas: `window.THEMES`

El hub expone `window.THEMES` como un mapa de temas con claves y definiciones de color. La compatibilidad visual del proyecto se apoya en ese objeto y la superficie pública que aparece en el código actual es:

- `window.THEMES[key].accent`

Esto debe tratarse como una superficie de compatibilidad visual del hub, no como un sistema completo de diseño para todos los minijuegos.

## 10. Degradación cuando `GameCenter` no está disponible

El documento no define una API alternativa que reemplace a `GameCenter`; lo que sí está respaldado por el patrón actual es que el juego debe respetar la ausencia de la API y degradar de forma segura.

En la práctica, esto significa:

- si `window.GameCenter` no existe o no tiene `completeLevel`, el juego no debe asumir que puede liquidar la recompensa del hub;
- la oferta de rewards del juego debe comportarse como un resultado local o no ejecutarse si no hay contexto del hub;
- la integración no debe inventar un contrato de fallback que el código actual no haya implementado.

## 11. Checklist de integración

Un minijuego está integrado de forma compatible con el contrato actual si:

1. vive bajo `games/`;
2. tiene un `index.html` local;
3. ofrece una salida o retorno al hub principal;
4. registra recompensas mediante `window.GameCenter.completeLevel()`;
5. mantiene su estado local aislado del estado del hub;
6. evita sobrescribir globals reservados;
7. usa `window.THEMES` solo como compatibilidad visual si procede;
8. no duplica la lógica de economía del proyecto central;
9. responde con degradación segura si `GameCenter` no está disponible.

## 12. Límites documentales

Este documento no define nuevas APIs ni nuevos contratos de negocio no confirmados por el código actual. Cualquier regla adicional del juego debe mantenerse en el README local del juego y no debe confundirse con el contrato global del hub.

## 13. Referencias cruzadas

- [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/DOMAIN.md](./DOMAIN.md)
- [docs/DOCUMENTATION_POLICY.md](./DOCUMENTATION_POLICY.md)
- [README.md](../README.md)

## 14. Ejemplos de referencia

Los siguientes fragmentos ilustran el contrato documentado en las secciones
anteriores. Cada juego sigue siendo una página independiente bajo `games/` y
debe conservar sus identificadores y su almacenamiento aislados del hub.

### Namespacing del juego

Use un prefijo propio para las claves de almacenamiento y los identificadores
del juego. Encapsular la implementación evita añadir nombres genéricos a
`window`:

```js
(() => {
    const PUZZLE_STORAGE_KEY = 'PUZZLE_highscore';

    function PUZZLE_saveHighScore(score) {
        localStorage.setItem(PUZZLE_STORAGE_KEY, String(score));
    }

    // La lógica del juego puede llamar a PUZZLE_saveHighScore(score) localmente.
})();
```

### Conversión de economía interna

Convierta la puntuación o divisa interna del juego a un entero de monedas de
Love Arcade antes de llamar al hub:

```js
const puntosInternos = 5000;
const monedasLoveArcade = Math.floor(puntosInternos / 100);

window.GameCenter.completeLevel(
    'rompecabezas',
    'partida_1',
    monedasLoveArcade
);
```

### Degradación elegante

Un juego abierto sin el hub puede conservar su resultado local y omitir el
registro de la recompensa global sin interrumpir su ejecución:

```js
if (typeof window.GameCenter !== 'undefined' &&
    typeof window.GameCenter.completeLevel === 'function') {
    window.GameCenter.completeLevel('rompecabezas', 'nivel_3_completado', 25);
} else {
    console.warn('[PUZZLE] Modo standalone: recompensa no registrada en el hub.');
}
```

### `window.debounce(fn, delay)`

La utilidad exportada por el hub recibe una función y un retraso opcional de
300 ms. Su firma JSDoc coincide con la implementación actual:

```js
/**
 * @param {Function} fn Función a debounce-ar.
 * @param {number} delay Espera en ms antes de ejecutar (por defecto 300 ms).
 * @returns {Function}
 */
function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

window.debounce = debounce;
```

Por ejemplo, un juego puede usarla para limitar recálculos en `resize` y
mantener un fallback local cuando se ejecute sin el hub:

```js
const PUZZLE_onResize = typeof window.debounce === 'function'
    ? window.debounce(PUZZLE_recalcularLayout, 200)
    : PUZZLE_recalcularLayout;

window.addEventListener('resize', PUZZLE_onResize);
```
