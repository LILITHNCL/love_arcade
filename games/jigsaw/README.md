# marejigweb — Fases 1 y 2

Scaffold y motor geométrico inicial para el juego `marejigweb`, alojado en `games/jigsaw/` y registrado ante Love Arcade con `gameId` público `jigsaw`.

## Alcance implementado

### Fase 1 — scaffold de producción

- app shell premium mobile-first;
- pantalla principal de niveles pendientes;
- catálogo inicial de 5 niveles;
- adaptador Cloudinary sin secretos;
- carga lazy de thumbnails;
- carga de imagen full solo al seleccionar nivel;
- storage seguro bajo claves `MAREJIG_`;
- adaptador económico preparado para `window.GameCenter.completeLevel("jigsaw", levelId, coins)`;
- contenedor futuro del juego con `<canvas id="marejig-canvas">`.

### Fase 2 — motor geométrico

- biblioteca de formas poliminó ortogonales en `MAREJIG_shapes.js`;
- generador determinístico por `level.id` en `MAREJIG_generator.js`;
- board estándar `16×12` con cobertura exacta de 192 celdas;
- target estándar de 60 piezas, validado dentro del rango 56–64;
- grafo de adyacencia real por lados compartidos;
- `neighborIds`, `segmentId`, `groupId` y contornos serializables por pieza;
- segmentos progresivos con `s_0` revelado inicialmente;
- grupos iniciales de una pieza y helpers puros de merge/validación;
- debug visual temporal en Canvas con wireframe por segmento.

No incluye todavía drag, snap interactivo, fusión durante input ni gameplay final.

## Restricciones de integración

- No se sobrescriben `window.GameCenter`, `window.ECONOMY`, `window.THEMES`, `CONFIG`, `ECONOMY` ni `THEMES`.
- No se leen ni escriben claves globales de `localStorage` de Love Arcade.
- Todas las claves de storage propias usan prefijo `MAREJIG_`.
- Los selectores CSS propios usan prefijo `.marejig-*`.
- El juego funciona standalone si `window.GameCenter` no existe.
- `../../js/app.js` se carga al final del `<body>` después de los scripts propios.

## Cloudinary

`MAREJIG_config.js` usa `cloudName: "demo"` como placeholder público de desarrollo. Para producción, reemplazarlo por el Cloudinary cloud name real. No se deben colocar API keys, API secrets ni tokens privados en frontend.

Los public IDs de ejemplo siguen el patrón:

```text
marejig/levels/<level_id>
```

Si esas URLs no existen, el scaffold muestra un fallback visual y continúa funcionando sin errores fatales.

## Generador

La salida principal está disponible desde:

```js
window.MAREJIG_Generator.generate(level)
```

El generador no lee píxeles de la imagen. Solo usa metadata del nivel (`id`, board, dificultad, target y segment plan). La estrategia actual usa una partición serpentina determinística para garantizar cobertura completa, conteo estable y piezas conectadas; el modelo queda preparado para que el renderer construya `Path2D` desde los contornos serializables.
