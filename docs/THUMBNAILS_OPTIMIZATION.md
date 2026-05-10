# Optimización de thumbnails de juegos (Cloudinary AVIF 742x310)

Fecha: 2026-05-10

## Cambios implementados

Se actualizaron las portadas del catálogo de juegos en `index.html` para consumir assets optimizados nativos en Cloudinary:

- Antes: URLs con transformación en runtime (`f_auto,q_auto,ar_16:9,c_fill,g_auto,w_1080`).
- Ahora: URLs directas a archivos `.avif` ya preprocesados en **742x310**.

Esto elimina sobre-dimensionamiento (1080px de ancho) para un contenedor visual aproximado de ~371x155 CSS px y alinea la entrega con una estrategia efectiva de ~2x DPR.

## Beneficio esperado

- Menor transferencia por imagen.
- Mejor tiempo de carga percibido en la sección de juegos.
- Reducción de riesgo de LCP degradado por thumbnails oversized.

## Cobertura

Se aplicó a todas las portadas del grid principal:

- `rompecabezas_cover_art.avif`
- `wordhunt_cover_art.avif`
- `ollin_smash_cover_art.avif`
- `space_shooter_cover_art.avif`
- `2048_cover_art.avif`
- `jungle_dash_cover_art.avif`
- `dodger_cover_art.avif`
