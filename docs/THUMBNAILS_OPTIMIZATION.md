# Optimización de thumbnails de juegos (Cloudinary responsive + `<img srcset>`)

Fecha: 2026-05-10

## Cambios implementados

Se migraron las portadas del catálogo principal (`section#games`) desde `background-image` inline hacia imágenes reales `<img>` dentro de `.card-cover`.

### Antes
- `div.card-cover` con `style="background-image: ..."`.
- URL fija con estrategia no responsive en iteraciones previas.

### Ahora
- Cada card usa `<img class="card-cover-img">` con:
  - `srcset` Cloudinary manteniendo proporción original optimizada: `w_371`, `w_742`.
  - `sizes="(max-width: 767px) 370px, 371px"`.
  - Transformaciones conservadas: `f_auto,q_auto` (sin forzar `ar_16:9`).
- Primer thumbnail marcado con `fetchpriority="high"` (candidato a LCP).
- Resto de thumbnails con `loading="lazy"`.
- Se agregó `.card-cover-img` en CSS con `object-fit: cover; width: 100%; height: 100%; display: block;` para mantener el recorte y composición visual.
- El overlay visual (`.card-cover::after`) se mantiene sin cambios funcionales para ocultar microartefactos y preservar la estética.

## Beneficio esperado

- Selección de recurso más precisa por viewport/DPR.
- Menor transferencia promedio en móviles y tablets.
- Mejor equilibrio nitidez/peso sin alterar el encuadre original 742x310.
- Menor riesgo de degradar LCP por thumbnails sobredimensionadas.

## Cobertura

Aplicado a todas las portadas del grid principal:
- `rompecabezas_cover_art`
- `wordhunt_cover_art`
- `ollin_smash_cover_art`
- `space_shooter_cover_art`
- `2048_cover_art`
- `jungle_dash_cover_art`
- `dodger_cover_art`
