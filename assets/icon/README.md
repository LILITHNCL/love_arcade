# Documentación de Identidad Visual y Assets (Iconos)

Este documento contiene las especificaciones técnicas para la recreación, edición o escalado de los iconos de la PWA. Los archivos fuente se encuentran en esta misma carpeta.

## Icono Principal (Brand Icon)
El icono principal utiliza un diseño de pixel art con un relleno degradado tricolor complejo.

### Especificaciones del Degradado (Relleno)
El degradado fue generado en **IbisPaint X** utilizando el filtro **"Graduación paralela"**.

| Parámetro | Valor |
| :--- | :--- |
| **Color Inicial (Superior Izquierda)** | `#4A0404` |
| **Color Central (Intermedio)** | `#8B0000` |
| **Color Final (Inferior Derecha)** | `#BC0000` |
| **Ángulo** | 135° |
| **Longitud de onda** | 1024 px |
| **Fase** | 0% |
| **Intermedio** | 50% |
| **Contraste** | 0% |
| **Método de extensión** | Reflejar |

### Arte y Exportación (Piskel)
El arte central fue desarrollado en **Piskel**. 
- **Archivo Fuente:** `icon_main.piskel`
- **Escalabilidad:** El formato `.piskel` permite exportar el diseño a cualquier resolución sin pérdida de definición (vectorización de píxeles). Para el Splash Screen y pantallas de alta densidad (Tablets 2K), se debe exportar a **512x512px** o superior.

---

## Icono de Notificaciones (Android Badge)
Para garantizar la compatibilidad con el sistema de notificaciones de Android, se ha creado una versión específica.

- **Archivo:** `icon-notification.png`
- **Resolución:** 192x192 px.
- **Color:** 100% Blanco (`#FFFFFF`) con fondo transparente.
- **Uso:** Este asset se utiliza en la propiedad `badge` del Service Worker. 
- **Nota técnica:** Android ignora los colores en los iconos de la barra de estado; por ello, este archivo es monocromático para evitar que el sistema lo renderice como un bloque sólido sin forma.

---

## Flujo de trabajo para actualizaciones
1. **Para cambios en el fondo:** Abrir IbisPaint X, crear un lienzo de 1024x1024 y aplicar el filtro "Graduación paralela" con los parámetros arriba descritos.
2. **Para cambios en el logo:** Importar `icon_main.piskel` en [PiskelApp](https://www.piskelapp.com/).
3. **Exportación:** Al exportar desde Piskel para el Splash Screen, asegurar que el tamaño de salida sea consistente con el definido en el `manifest.json` (mínimo 512px).