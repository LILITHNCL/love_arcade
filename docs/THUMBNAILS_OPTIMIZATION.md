# Optimización de thumbnails de juegos (AVIF responsivo)

Fecha: 2026-05-10
Actualizado: 2026-08-24

## Cambios implementados

- Las thumbnails del catálogo principal dejaron de usar Cloudinary y ahora se cargan desde rutas locales del repositorio (`assets/images/games/cover/*.avif`).
- Todas las cards del catálogo principal (`section#games`) usan AVIF responsivo con cuatro variantes de ancho por portada: `512w`, `640w`, `768w` y `1024w`.
- Cada `<img class="card-cover-img">` usa:
  - `src="...-768.avif"` como recurso base/fallback.
  - `srcset` con las variantes `-512.avif 512w`, `-640.avif 640w`, `-768.avif 768w` y `-1024.avif 1024w`.
  - `sizes="(min-width: 1024px) 190px, (min-width: 768px) 170px, calc((100vw - 36px) / 2)"` para que el navegador elija la variante adecuada según el viewport.
- Se mantienen atributos de rendimiento:
  - Primer thumbnail con `fetchpriority="high"` (candidato LCP).
  - Resto con `loading="lazy"`.
  - Todas con `decoding="async"`.
- Las dimensiones intrínsecas declaradas en HTML son `width="768"` y `height="528"`.
- En CSS, `.card-cover` usa `aspect-ratio: 16 / 11` como ratio base móvil para reservar espacio y evitar layout shift. En desktop (`@media (min-width: 768px)`), `.card-cover` pasa a `aspect-ratio: auto` y se adapta al layout flexible de `.game-card`.

## Motivo de la implementación actual

La documentación anterior describía un estado intermedio con una única imagen AVIF directa y sin `srcset`/`sizes`. La implementación actual fue mejorada para servir resoluciones distintas según el dispositivo, de modo que los teléfonos no tengan que decodificar imágenes más grandes de lo necesario. Esto reduce presión de memoria RAM y mantiene una buena calidad visual en pantallas más grandes.

## Riesgo y mitigación de rendimiento

- Riesgo: demasiadas variantes cacheadas pueden aumentar el tamaño total del app shell si se agregan portadas nuevas sin revisar la estrategia de precache.
- Mitigación aplicada:
  - el navegador descarga solo la variante más apropiada para el tamaño renderizado gracias a `srcset` y `sizes`;
  - solo la primera card va con prioridad alta;
  - lazy loading en tarjetas no críticas;
  - reserva de espacio con dimensiones intrínsecas + `aspect-ratio` para evitar CLS;
  - el service worker cachea explícitamente las variantes usadas por el catálogo principal.

## Cobertura

Aplicado a todas las portadas del grid principal:

- Marejig:
  - `assets/images/games/cover/marejig-cover-512.avif`
  - `assets/images/games/cover/marejig-cover-640.avif`
  - `assets/images/games/cover/marejig-cover-768.avif`
  - `assets/images/games/cover/marejig-cover-1024.avif`
- Word Hunt:
  - `assets/images/games/cover/word-hunt-cover-512.avif`
  - `assets/images/games/cover/word-hunt-cover-640.avif`
  - `assets/images/games/cover/word-hunt-cover-768.avif`
  - `assets/images/games/cover/word-hunt-cover-1024.avif`
- Ollin Smash:
  - `assets/images/games/cover/ollin-smash-cover-512.avif`
  - `assets/images/games/cover/ollin-smash-cover-640.avif`
  - `assets/images/games/cover/ollin-smash-cover-768.avif`
  - `assets/images/games/cover/ollin-smash-cover-1024.avif`
- Vortex:
  - `assets/images/games/cover/space-shooter-cover-512.avif`
  - `assets/images/games/cover/space-shooter-cover-640.avif`
  - `assets/images/games/cover/space-shooter-cover-768.avif`
  - `assets/images/games/cover/space-shooter-cover-1024.avif`
- 2048:
  - `assets/images/games/cover/2048-cover-512.avif`
  - `assets/images/games/cover/2048-cover-640.avif`
  - `assets/images/games/cover/2048-cover-768.avif`
  - `assets/images/games/cover/2048-cover-1024.avif`
- Jungle Dash:
  - `assets/images/games/cover/jungle-dash-cover-art-512.avif`
  - `assets/images/games/cover/jungle-dash-cover-art-640.avif`
  - `assets/images/games/cover/jungle-dash-cover-art-768.avif`
  - `assets/images/games/cover/jungle-dash-cover-art-1024.avif`
- Dodger:
  - `assets/images/games/cover/dodger-cover-art-512.avif`
  - `assets/images/games/cover/dodger-cover-art-640.avif`
  - `assets/images/games/cover/dodger-cover-art-768.avif`
  - `assets/images/games/cover/dodger-cover-art-1024.avif`

## Verificación con la implementación

- `index.html` declara `src="...-768.avif"`, `srcset` con `512w/640w/768w/1024w`, `sizes` responsivo y dimensiones `width="768" height="528"` en las siete portadas del catálogo principal.
- `styles.css` declara `.card-cover { aspect-ratio: 16 / 11; }` como base móvil y lo ajusta a `aspect-ratio: auto` en desktop.
- `sw.js` precachea las cuatro variantes por portada (`-512`, `-640`, `-768`, `-1024`) dentro de `APP_SHELL_FILES`.
