# Optimización de thumbnails de juegos (AVIF 1920x804 directo)

Fecha: 2026-05-10

## Cambios implementados

- Las thumbnails del catálogo principal dejaron de usar Cloudinary y ahora se cargan desde rutas locales del repositorio (`assets/images/games/cover/*.avif`).
- Todas las cards del catálogo principal (`section#games`) ahora consumen imagen directa AVIF a resolución base `1920x804`.
- Se eliminaron `srcset` y `sizes` porque no se usarán variantes por densidad.
- Se mantienen atributos de rendimiento:
  - Primer thumbnail con `fetchpriority="high"` (candidato LCP).
  - Resto con `loading="lazy"`.
  - Todas con `decoding="async"`.
- Se actualizaron dimensiones intrínsecas en HTML a `width="1920"` y `height="804"`.
- En CSS, `.card-cover` migró de altura fija a `aspect-ratio: 1920 / 804` para evitar layout shift.

## Riesgo y mitigación de rendimiento

- Riesgo: imágenes más pesadas pueden aumentar LCP en redes lentas.
- Mitigación aplicada:
  - solo la primera card va con prioridad alta;
  - lazy loading en tarjetas no críticas;
  - reserva de espacio con dimensión intrínseca + `aspect-ratio` para evitar CLS.

## Cobertura

Aplicado a todas las portadas del grid principal:
- `assets/images/games/cover/rompecabezas-cover-art.avif`
- `assets/images/games/cover/word-hunt-cover-art.avif`
- `assets/images/games/cover/ollin-smash-cover-art.avif`
- `assets/images/games/cover/space-shooter-cover-art.avif`
- `assets/images/games/cover/2048-cover-art.avif`
- `assets/images/games/cover/jungle-dash-cover-art.avif`
- `assets/images/games/cover/dodger-cover-art.avif`
