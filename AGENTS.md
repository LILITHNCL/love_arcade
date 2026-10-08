# Instrucciones del proyecto

Estas instrucciones aplican a cualquier agente de IA que trabaje en este repositorio.

## Git

Siempre se parte de la versión más actualizada del repositorio en GitHub (`origin`), nunca de una copia local desactualizada.

- Nunca trabajar directamente sobre `main`.
- Toda implementación debe realizarse en una nueva branch basada en `origin/main`.
- Antes de crear una branch, ejecutar `git fetch origin`.
- La branch debe comenzar desde el estado actualizado de `origin/main`, por ejemplo: `git switch -c nombre-de-la-branch origin/main`.
- Usar nombres descriptivos en español para las branches.
- Hacer commit únicamente cuando la implementación y las comprobaciones hayan terminado correctamente.
- Hacer push de la branch al remoto `origin`.
- Nunca hacer push directamente a `main`.
- Nunca hacer force push.
- No eliminar branches remotas.
- No modificar commits existentes salvo que se solicite explícitamente.

## Implementación

Antes de editar:
- Analizar primero el código existente antes de modificarlo.
- Inspeccionar el componente, los estilos, el enrutamiento y los patrones de diseño existentes.
- Reutilizar componentes, tokens, utilidades y convenciones existentes cuando sea posible.
- Identificar el cambio más pequeño y seguro que logre el resultado pedido.

Durante la edición:
- Mantener las convenciones existentes del proyecto.
- Evitar cambios no relacionados con la tarea.
- Mantener estable el comportamiento del producto salvo que se pida lo contrario.
- Evitar reescrituras amplias cuando bastan cambios puntuales.
- Mantener los componentes legibles y mantenibles.
- Eliminar código de interfaz muerto o duplicado cuando esté directamente relacionado con la tarea.

Después de editar:
- Revisar el diff en busca de regresiones visuales, regresiones de accesibilidad y cambios innecesarios.

### Dependencias

- No añadir dependencias sin evaluar primero si ya existe una solución en el proyecto.
- No añadir dependencias de runtime solo para satisfacer la recomendación de una skill.
- Preferir el HTML, CSS, JavaScript, TypeScript, framework, componentes, sistema de estilos y librerías de animación que el proyecto ya usa.
- Añadir una dependencia de runtime solo cuando:
  - el usuario la solicite directamente, o
  - el proyecto ya use ese stack y la dependencia sea coherente con la arquitectura existente.
- Si una skill recomienda una librería que el proyecto no usa, adaptar la idea con el stack existente.

## Validación

Usar el gestor de paquetes y los scripts que ya existen en el repositorio. No inventar scripts: revisar primero `package.json` o la documentación del repositorio.

- Ejecutar los tests relevantes después de implementar.
- Ejecutar el build correspondiente.
- Ejecutar también, cuando existan, las comprobaciones de lint, typecheck y formato.
- Si aparecen errores, corregirlos y volver a ejecutar las comprobaciones.
- No declarar la tarea terminada mientras existan errores conocidos.
- Si alguna comprobación no se puede ejecutar, explicar por qué.

## Skills de frontend del proyecto

Este repositorio incluye Agent Skills locales en `.agents/skills`.

Antes de hacer cambios de UI, layout, estilos, accesibilidad o animación, leer los `SKILL.md` relevantes y usar el conjunto más pequeño de skills que se ajuste a la tarea.

| Skill | Usar cuando |
| --- | --- |
| `frontend-design` | Se construye o se rediseña de forma sustancial una página, componente, layout, dashboard, landing page o experiencia visual de frontend. |
| `baseline-ui` | Se construye o revisa UI en cuanto a espaciado, tipografía, comportamiento responsive, calidad de Tailwind/CSS, jerarquía visual y acabado general. Preservar el stack existente del proyecto. |
| `fixing-accessibility` | Se revisa o corrige HTML semántico, ARIA, etiquetas, formularios, diálogos, acceso por teclado, gestión del foco, contraste, estados de error o comportamiento con movimiento reducido. |
| `fixing-motion-performance` | Se añaden o revisan animaciones, transiciones, efectos ligados al scroll, layout thrashing, rendimiento de renderizado o jank en animaciones. |
| `emil-design-eng` | Se pulen microinteracciones, el criterio de movimiento, los detalles de componentes, la sensación de interacción y la calidad percibida del producto. |
| `caveman` | Modo de comunicación ultracomprimido para respuestas técnicas breves y eficientes en tokens, solo cuando se solicite explícitamente. |
| `grill-me` | Poner a prueba un plan o diseño de forma implacable, haciendo una pregunta a la vez y recomendando una respuesta. |
| `diagnose` | Diagnóstico disciplinado de bugs o problemas de rendimiento: reproducir → minimizar → hipotetizar → instrumentar → corregir → test de regresión. |

### Selección de skills

No usar todas las skills por defecto.

Para UI nueva o rediseños importantes:
- Usar `frontend-design`.
- Usar `baseline-ui`.
- Usar `fixing-accessibility`.
- Añadir `emil-design-eng` cuando importe el pulido de la interacción.
- Añadir `fixing-motion-performance` cuando haya animaciones o transiciones.

Para revisión de UI:
- Usar `baseline-ui`.
- Usar `fixing-accessibility`.
- Añadir `fixing-motion-performance` si la UI contiene movimiento, transiciones, efectos de scroll, animaciones al pasar el cursor o animaciones de carga.

Para trabajo de animación:
- Usar `fixing-motion-performance`.
- Usar `emil-design-eng`.
- Usar `fixing-accessibility` para asegurar que se gestiona el movimiento reducido.

### Nivel de calidad en frontend

No basta con que la funcionalidad opere: debe sentirse terminada.

Para cambios de frontend, comprobar que:

- La jerarquía visual es clara.
- La acción principal es obvia.
- El espaciado y la alineación son consistentes.
- La tipografía es legible e intencional.
- El layout funciona en móvil, tablet y escritorio.
- Se manejan los estados de carga, vacío, error, éxito y deshabilitado.
- Los elementos interactivos tienen estados hover, focus, active y de teclado cuando corresponda.
- La accesibilidad no se degrada.
- El comportamiento existente se preserva salvo que se haya pedido un cambio.

### Nivel de calidad en movimiento

Usar movimiento solo cuando mejore la claridad, el feedback o la calidad percibida.

Preferir:
- `opacity`
- `transform`
- transiciones cortas y sutiles
- soporte para movimiento reducido

Evitar:
- layout jank
- rebotes excesivos
- animaciones decorativas lentas
- animar width, height, top, left u otras propiedades que afecten al layout, salvo que sea necesario
- añadir animaciones que bloqueen la interacción

## Finalización

Al terminar, informar:
1. Qué se implementó.
2. Qué archivos cambiaron.
3. Qué tests/build se ejecutaron.
4. Resultado de las comprobaciones.
5. Nombre de la branch.
6. Commit creado.
7. Si el push fue exitoso.

Además, en tareas de frontend, incluir:
- Qué skills se usaron.
- Qué cambió visualmente.
- Qué cambió en accesibilidad.
- Qué cambió en movimiento o pulido de interacción.
- Riesgos, comprobaciones omitidas o recomendaciones de seguimiento.

## Ejemplos de prompts

Se pueden invocar skills de forma explícita, por ejemplo:

- `Usa frontend-design y baseline-ui para construir esta página.`
- `Usa frontend-design, baseline-ui y fixing-accessibility para rediseñar esta pantalla de ajustes.`
- `Usa fixing-accessibility para revisar index.html.`
- `Usa fixing-motion-performance y emil-design-eng para pulir esta animación.`
- `Usa baseline-ui y fixing-accessibility para auditar este componente antes de publicarlo.`
