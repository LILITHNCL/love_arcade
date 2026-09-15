# Preview de Tienda y Colección: interacción y rendimiento

## Contrato de activación

Las tarjetas visuales son elementos `<button class="shop-visual-card">`. Cada grid
(`#shop-container` y `#collection-container`) registra **un único** listener delegado
mediante `_bindCardPreviewActivation(container, openItem)`. El helper resuelve el
botón más cercano desde `event.target`, confirma que sigue siendo descendiente del
contenedor enlazado y recupera el artículo actual desde `data-item-id` y `allItems`.
Por tanto, las tarjetas añadidas por el render incremental o por una búsqueda de
Colección no reciben listeners individuales y funcionan inmediatamente.

El `click` nativo del botón es la única ruta que abre el modal: un click/tap abre una
vez y Enter/Espacio conservan la activación nativa accesible. Los Pointer Events no
abren el modal; solo registran un gesto para suprimir su click posterior si el puntero
se desplazó más de **10 px** (distancia euclídea, vertical u horizontal). Ese umbral
se eligió para tolerar el temblor normal de un tap sin confundir un inicio de scroll
con una intención de abrir el preview.

El helper no instala cancelación global por `scroll`, no llama a `preventDefault()` y
no lee ni sincroniza layout. Así el navegador mantiene el desplazamiento táctil
pasivo y fluido; el handler se limita a mapas pequeños de punteros y a una búsqueda
en memoria cuando llega un click válido. Tampoco inicia solicitudes de red.

## Estrategia de imagen

La tarjeta solicita una transformación Cloudinary ajustada a su ancho. El preview usa
deliberadamente una variante de **1200 px**, construida por `_getPreviewImageUrl()`;
es mejor para el modal y no se reutiliza como thumbnail de tarjeta. Para aprovechar
la caché, `_preloadItemHiRes()` de Tienda solicita exactamente esa misma URL de 1200
px cuando una tarjeta se aproxima al viewport. La Colección no amplía esta precarga:
sus previews cargan bajo demanda.

Abrir el modal nunca espera a la descarga: se quita `.hidden` antes de renderizar la
imagen. `<img class="preview-image">` conserva `decoding = 'async'`, tiene una
relación de aspecto fijada a partir del artículo y completa la carga progresivamente,
evitando saltos de layout. La precarga usa prioridad baja, un `IntersectionObserver`
y lotes idle; no se añade trabajo síncrono al tap.

## Presupuesto y medición

En una prueba de dispositivo móvil representativo, medir por separado:

- **INP** de los taps sobre las tarjetas, con Web Vitals o el panel Performance.
- **Tiempo de apertura**: desde `click` hasta que `#preview-modal` deja de tener la
  clase `.hidden`; usar una marca de usuario o una aserción de navegador.
- **Tasa de previews abiertos por tap**: aperturas válidas / taps intencionales.
- **Tasa de aperturas accidentales tras swipe**: aperturas / swipes verticales; debe
  permanecer en cero en la muestra de regresión.

Registrar red y Main Thread durante scroll: deben verse como máximo un listener por
contenedor, precargas de prioridad baja y ninguna lectura de layout, `preventDefault`
o solicitud de red iniciada por el handler de activación.
