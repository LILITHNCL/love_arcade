# Migración de catálogo de tienda — TICKET-01

## Decisión de producto aplicada

Los 12 regalos gratuitos con requisito de partida se **retiran de la publicación**. No se convierten automáticamente en productos comprables porque la auditoría no aporta una decisión de precio ni de visibilidad para ellos. La revisión de IDs confirmó que los 12 regalos eran alias de ítems ya publicados con el mismo ID y el mismo nombre; no eran activos nuevos. `data/retired-shop-gift-ids.json` registra esos IDs y sus alias publicados exclusivamente para verificar esta decisión; no es un catálogo ni se carga en la aplicación.

Esta decisión preserva el significado de `store.inventory[id]`: se retira solamente la presentación alternativa de regalo y cada ID continúa representando el mismo ítem publicado. Cualquier recuperación futura de esos activos deberá definir su comportamiento de producto y mantener sus IDs históricos.

## Contrato publicado

`data/shop.json` contiene únicamente objetos con `id`, `name`, `price`, `category: "art"`, `type`, `imageUrl` y `downloadUrl` solo para `type: "file"`. `imageUrl` conserva la URL Cloudinary original, sin transformaciones.

## Verificación previa a publicación

Ejecuta `node tests/shop-catalog-static-qa.mjs`. La comprobación valida el contrato publicado, la ausencia de `data/shop-gifts.json` y que toda colisión histórica sea uno de los alias documentados.
