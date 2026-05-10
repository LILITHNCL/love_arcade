# Optimización de thumbnails de juegos (AVIF 1920x804 directo)

Fecha: 2026-05-10

## Cambios implementados

- Se eliminaron transformaciones automáticas de Cloudinary (`f_auto,q_auto,w_*`).
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
- `rompecabezas_cover_art`
- `wordhunt_cover_art`
- `ollin_smash_cover_art`
- `space_shooter_cover_art`
- `2048_cover_art`
- `jungle_dash_cover_art`
- `dodger_cover_art`
