# Player Hub — Ronda 2: banding persistente y propuesta de degradado fijo

**Estado de partida:** TICKET-01, TICKET-02, TICKET-03 y TICKET-05 ya implementados (verificado en `styles-v2.css`). TICKET-04 (segunda capa de profundidad) **no** se implementó.

**Problema reportado:** el color banding sigue siendo perceptible **de forma continua** en el Player Hud, pese al `filter: blur(26px)` (desktop) / `blur(8px)` (móvil) ya aplicado.

---

## 1. Verificación de lo implementado (HECHO)

Confirmado en `styles-v2.css`:

- `.player-hud::before` (líneas 916-929): mismo gradiente de dos manchas, ahora con `filter: blur(26px)`.
- `.player-hud.is-ready::before` (947-950): `animation: hudAmbientSweep 14s linear infinite` — sin `alternate`, bucle cerrado de 5 keyframes (961-977), amplitud ampliada (`translate3d` hasta ±14%, `scale` hasta 1.05, `rotate` de -1° a 2°). **TICKET-02 correctamente implementado.**
- `@media (pointer: coarse)` (4186-4189): `.player-hud::before { filter: blur(8px); }` — reducción de blur en móvil siguiendo la misma proporción que `.mockup-bg-offline`. **TICKET-03 correctamente implementado.**
- `motion-paused` y `prefers-reduced-motion` siguen cubriendo `.player-hud::before` correctamente.

Es decir: Codex ejecutó exactamente lo que especificaban los tickets. El hecho de que el banding persista **no es un error de implementación** — es evidencia de que la técnica elegida (blur sobre el gradiente animado) tiene un límite estructural que no habíamos cuantificado en la Ronda 1.

---

## 2. Por qué el banding sigue ahí (diagnóstico actualizado)

### 2.1 El blur es proporcionalmente insuficiente para el tamaño real del elemento (INFERENCIA, con evidencia de comparación directa)

`.player-hud::before` mantiene `inset: -35%`, es decir, mide ~170% del ancho de `.player-hud`. El contenedor (`.container`, `styles.css:867`) tiene `max-width: 1200px`, y en el breakpoint de tablet/desktop `.player-hud` pasa a `flex-direction: row` (`styles.css:3073`), pudiendo ocupar varios cientos de píxeles de ancho. Con los stops actuales (`transparent` al 48% y 42% del radio), la zona de transición del gradiente se extiende sobre cientos —potencialmente miles— de píxeles en pantallas grandes.

Comparado con el precedente que usamos como referencia (`neonFlowDrift`):

| Componente | Tamaño aprox. de la superficie | Blur aplicado | Blur ÷ tamaño |
|---|---|---|---|
| `.mockup-bg-offline::before` (modal grande) | Modal de preview, cientos de px | 40px | proporción alta |
| `.shop-img--offline::before` (card pequeña) | ~150-190px de ancho | 30px | proporción **muy** alta (~20% del ancho) |
| `.player-hud::before` (HUD) | Hasta ~1200px en desktop/tablet | 26px | proporción **baja** (~2-7% del ancho) |

El radio de blur que "funcionó" en los otros dos casos era grande **en relación a su propio tamaño**. Aplicado tal cual (26px) a una superficie mucho más ancha, el blur sigue suavizando bordes duros muy locales, pero dentro de la franja de transición sigue habiendo pasos de color de 8 bits que el blur no llega a mezclar entre sí porque están a más distancia entre ellos que el propio radio de blur.

### 2.2 El blur nunca fue la técnica "correcta" para este tipo de banding — es una solución parcial (INVESTIGACIÓN EXTERNA)

Investigué específicamente esto porque el diagnóstico de la Ronda 1 se apoyó demasiado en el precedente interno sin contrastarlo con la literatura técnica. Lo que encontré, incluyendo una discusión del propio CSS Working Group del W3C, es consistente y coincide entre varias fuentes independientes:

- El banding de 8 bits en gradientes grandes de bajo contraste (exactamente nuestro caso: negro casi puro → negro casi puro) es un fenómeno de cuantización que ocurre **independientemente del blur**, porque el blur suaviza bordes espaciales pero el resultado final vuelve a cuantizarse a 8 bits por canal al componerse en pantalla.
- La técnica establecida y ampliamente documentada para este problema específico —incluida una respuesta directa de un editor de especificaciones CSS del W3C, calificándola de "práctica común y bien establecida"— es superponer un **overlay de ruido/dithering** de baja opacidad (típicamente 1-5%) sobre el gradiente. El ruido rompe visualmente los escalones de cuantización sin necesidad de que el blur cubra toda la distancia de la transición.
- Blur y ruido no son intercambiables: blur ataca bordes duros; ruido ataca la cuantización en sí. Nuestro caso necesita lo segundo.

**Dato relevante que ya teníamos y no aprovechamos:** este mismo repositorio ya implementa exactamente esa técnica de ruido (`styles.css:3701` y `3717`, un `feTurbulence` SVG de baja opacidad usado originalmente como medida "anti-extracción" sobre el arte del catálogo). Es la pieza que faltaba combinar con el blur ya aplicado.

### 2.3 Segunda fuente de banding no cubierta por ningún ticket anterior (HECHO)

`.player-hud::after` (`styles.css:931-938`, sin cambios desde la Ronda 1):

```css
.player-hud::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(180deg, rgba(255,255,255,0.035), transparent 42%);
    pointer-events: none;
}
```

Este es un `linear-gradient` de blanco al 3.5% de opacidad hacia transparente, **sin blur, sin ruido, y estático** (nunca ha tenido animación). TICKET-01 solo tocó `::before`; `::after` nunca recibió tratamiento. Un gradiente con un contraste tan bajo (3.5% de alpha) sobre fondo oscuro es, si acaso, **más propenso al banding** que las manchas del `::before`, y al ser estático (no depende de ninguna fase de animación) explica muy bien por qué el usuario percibe el banding "de forma continua": esta capa nunca dejó de estar ahí, sin corregir, durante toda la Ronda 1.

---

## 3. La propuesta del usuario: reemplazar el ambient animado por un degradado fijo

### 3.1 Evaluación honesta

**A favor (confirmado):**
- Elimina el 100% del coste de compositor continuo del Player Hud. Un fondo estático no necesita `will-change`, no necesita quedar "en pausa" fuera de pestaña, no consume ciclos de GPU en cada frame mientras la pantalla de inicio está abierta — que es, según la propia documentación del proyecto, el escenario de mayor duty-cycle de toda la app (a diferencia de `.mockup-bg-offline`, que solo se activa en un caso de borde).
- Permite resolver el banding con la técnica correcta (ruido) sin la restricción de "que no se note el patrón de repetición del ruido mientras el fondo se mueve" — al no moverse, el ruido puede ajustarse una sola vez con criterio puramente visual.
- Elimina el "hack" de sobredimensionado (`inset: -35%`) y todo el aparato de contención que existía únicamente para ocultar bordes durante la animación — simplifica el código.

**En contra / riesgo:**
- Se pierde la sensación de "vida" que aportaba el movimiento, aunque el propio objetivo de diseño original ("atmósfera, no protagonista") nunca exigió que el fondo se moviera — solo que "aportara vida constante". Un fondo estático bien diseñado, con buena dirección de gradiente y textura, puede cumplir ese objetivo sin animación (ver 3.2).
- Es un cambio de arquitectura, no un ajuste incremental — requiere limpieza de código y documentación para no dejar deuda técnica (cubierto en TICKET-07).

**Recomendación: sí, adoptar el degradado fijo.** Es la opción que resuelve el banding de raíz (no un parche adicional sobre el parche anterior), y es la que mejor sirve la prioridad que el usuario ha repetido en ambas rondas: rendimiento en gama baja por encima de la fidelidad del efecto de movimiento.

### 3.2 Dirección y composición del degradado (INVESTIGACIÓN EXTERNA + reutilización de tokens existentes)

Para la dirección y estructura, investigué convenciones de diseño de gradientes premium en UI, en vez de elegir un ángulo arbitrario:

- **135deg (de esquina superior-izquierda a inferior-derecha)** es la convención documentada para gradientes "dinámicos y modernos" en hero sections y tarjetas premium — se asocia a energía visual sin ser tan predecible como un gradiente vertical u horizontal puro.
- La convención de **"top-left lighting"** (la luz aparente viene de la esquina superior-izquierda) es un principio de percepción visual usado en interfaces desde hace décadas (Windows, macOS clásico) — coherente con mantener el punto más luminoso del degradado en esa zona.
- Las fuentes consultadas coinciden en que **las transiciones suaves (pocos stops, sin cortes duros) se leen como "premium"**, mientras que los cortes duros se leen como "playful/retro" — refuerza la decisión de mantener pocos stops y dejar que el ruido, no los cortes de color, aporte la textura.
- Patrón repetido en varias fuentes: gradiente diagonal de marca + capa de ruido superpuesta a baja opacidad + una franja de brillo suave en una esquina — es, casi literalmente, la misma composición que ya existe en este proyecto (`::before` con manchas de color + `::after` con sheen), solo que sin animar y con ruido añadido.

**Decisión de diseño:** mantener los mismos anclajes de color ya usados (`20% 30%` para la mancha de acento, `85% 72%` para el highlight blanco) — no hay razón para descartar una dirección artística ya aprobada, el problema nunca fue la composición sino la técnica de renderizado. Se añade **un degradado lineal a 135deg como capa base** (sustituyendo el color sólido plano `--solid-surface-float`), construido enteramente con tokens del sistema de Themes ya existente (`--accent`, `--solid-surface-float`, `--solid-surface-hi`), de modo que se adapta automáticamente a los 25 temas del mapa `THEMES` sin código adicional. Se añade una **capa de ruido** reutilizando el mismo SVG data-URI que el proyecto ya usa en `styles.css:3717`, sin coste de red ni asset nuevo.

### 3.3 Código de ejemplo (diseño propuesto, no implementación final — Codex debe ajustar dentro del ticket)

```css
/* ================================================================
   PLAYER HUD — Ambient background ESTÁTICO (reemplaza hudAmbientSweep)
   ================================================================
   Arquitectura:
   · .player-hud mantiene su `background` sólido (--solid-surface-float)
     como fallback instantáneo de primer paint.
   · ::before es ahora una composición de 4 capas, TODAS estáticas:
       1) ruido/dither (SVG feTurbulence, ya usado en el proyecto)
       2) mancha de acento (misma posición que la versión animada)
       3) highlight blanco (misma posición que la versión animada)
       4) degradado lineal 135deg construido con tokens de Theme
     No hay `transform`, no hay `@keyframes`, no hay `will-change`.
   · inset: 0 — ya no necesita sobredimensionarse porque no se mueve.
   ================================================================ */
.player-hud::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E"),
        radial-gradient(circle at 20% 30%, var(--accent-soft), transparent 55%),
        radial-gradient(circle at 85% 72%, rgba(255,255,255,0.07), transparent 48%),
        linear-gradient(
            135deg,
            color-mix(in srgb, var(--accent) 12%, var(--solid-surface-float) 88%) 0%,
            var(--solid-surface-float) 55%,
            var(--solid-surface-hi) 100%
        );
    background-repeat: repeat, no-repeat, no-repeat, no-repeat;
    background-size: 200px 200px, cover, cover, cover;
    opacity: 0.72; /* mismo valor final que ya estaba aprobado en la versión animada */
    pointer-events: none;
    border-radius: inherit;
}

/* NADA MÁS que añadir: sin @keyframes, sin animation, sin will-change,
   sin transform, sin reducción de blur en pointer:coarse (no hay blur
   obligatorio — ver TICKET-08 para un blur opcional puramente estético). */
```

**Notas de implementación para Codex:**
- Los valores `55%`/`48%` (antes `48%`/`42%`) y `12%` de mezcla de acento son puntos de partida razonados, no cifras cerradas — deben afinarse visualmente contra los mismos temas de referencia usados en QA (violeta por defecto, un tema claro tipo `white`, uno saturado tipo `magenta` o `lime`).
- El `background-size: 200px 200px` del ruido debe repetirse en mosaico (`repeat`) sin distorsión — es intencional que se vea texturizado, no una imagen única estirada.
- Si el equipo de diseño prefiere una capa de ruido menos perceptible, reducir la opacidad `0.045` dentro del propio SVG (no añadir una capa de opacidad CSS extra encima, para no complicar el stacking).

---

## 4. Tickets para Codex

### TICKET-04 — CANCELADO

Queda sin efecto. Añadir una segunda capa de profundidad **animada** contradice directamente la nueva dirección (cero animación continua en el ambient). Cerrar el ticket con referencia a TICKET-06.

---

### TICKET-06 — Reemplazar el ambient glow animado por un degradado estático basado en Themes

- **Prioridad:** P0
- **Dependencias:** Ninguna (sustituye el trabajo de TICKET-01/02/03 en este componente específico)
- **Confianza:** Alta — causa raíz del banding confirmada por dos factores independientes (proporción blur/tamaño insuficiente + falta de dithering), y la técnica de reemplazo reutiliza patrones ya existentes en el repositorio

**Objetivo**
Eliminar el color banding de forma definitiva y reducir a cero el coste de compositor continuo del ambient background del Player Hud, sustituyendo el gradiente animado por una composición estática de degradado + ruido, construida sobre los tokens del sistema de Themes.

**Evidencia**
- `styles-v2.css:916-929` (implementación actual con blur, aún con banding reportado).
- `styles-v2.css:931-938` (`::after`, capa estática nunca corregida — fuente adicional de banding).
- `styles.css:3701`, `3717` (patrón de ruido SVG ya existente y reutilizable).
- Comparación de proporción blur/tamaño (Sección 2.1 de este documento).

**Implementación**
1. Sustituir por completo la regla `.player-hud::before` (líneas 916-929) por la composición de 4 capas estáticas de la Sección 3.3 (ruido + 2 manchas radiales + degradado lineal 135deg con tokens de Theme).
2. Cambiar `inset: -35%` a `inset: 0` (ya no se necesita sobredimensionado).
3. Aplicar el mismo tratamiento de ruido a `.player-hud::after` si tras QA visual se confirma que sigue aportando banding perceptible (ver Sección 2.3) — puede resolverse añadiendo la misma capa de ruido como `background-image` adicional en `::after`, o subiendo su alpha base para que dependa menos de un degradado extremadamente sutil.
4. Confirmar que el degradado se recalcula correctamente para **todos** los temas del mapa `THEMES` (`index.html:43`), ya que usa `var(--accent)` vía `color-mix()`.

**Comportamiento esperado**
El halo se ve idéntico en posición y paleta a la versión animada (mismos anclajes de color), pero completamente inmóvil, sin bandas visibles, con una textura de grano sutil apenas perceptible que rompe la cuantización de color.

**Performance**
- Cero animación → cero coste de compositor recurrente. El único coste es el de un paint estático, equivalente al de cualquier imagen de fondo normal.
- No requiere `will-change`, no requiere pausas por visibilidad, no requiere reducción de blur en `pointer: coarse` (ver TICKET-07 para retirar esas reglas).

**Accesibilidad**
Ninguna implicación nueva. Al no haber animación, `prefers-reduced-motion` deja de tener nada que pausar en este elemento (ver TICKET-07 para limpiar el selector).

**Cleanup**
Ver TICKET-07 — este ticket se centra en la implementación nueva; la eliminación del código antiguo se trata por separado para poder revisarlos de forma independiente.

**Criterios de aceptación**
- No se percibe banding a zoom ×4-8 en capturas de pantalla, en al menos 3 temas (`violet` por defecto, uno claro `white`, uno saturado `magenta` o `lime`), en `::before` **y** `::after`.
- El fondo no presenta ningún movimiento ni transición continua — es una imagen estática desde el primer frame tras `.is-ready`.
- El halo conserva su posición y relación con el fuego (mismos anclajes 20%/30% y 85%/72%).

**Validación**
Inspección visual ampliada en los 3 temas de prueba + confirmación en DevTools de que `.player-hud::before` no aparece en el panel *Animations* ni en *Rendering → Paint flashing* tras el primer render.

**Riesgos**
- El degradado lineal 135deg puede alterar ligeramente el tono general del HUD respecto a la versión con fondo sólido plano — validar con diseño que el cambio de tono (de plano a diagonal sutil) sigue leyendo como parte de la misma familia visual "Arcade Solid".
- Si `::after` requiere su propio tratamiento de ruido (paso 3), revisar que no se dupliquen texturas de grano superpuestas de forma que se vuelvan demasiado visibles en conjunto.

---

### TICKET-07 — Eliminar código y documentación obsoletos del ambient glow animado

- **Prioridad:** P0
- **Dependencias:** TICKET-06 (debe implementarse después, no antes, para no dejar el HUD sin fondo en el intervalo)
- **Confianza:** Alta — es un ticket de limpieza mecánica sobre referencias ya identificadas exhaustivamente

**Objetivo**
Eliminar todo rastro del sistema de animación `hudAmbientSweep` en CSS, JS y documentación, para que no quede código muerto ni comentarios desactualizados en el repositorio.

**Evidencia — lista exhaustiva de referencias a eliminar/actualizar**
- `styles-v2.css:947-950` — regla `.player-hud.is-ready::before { opacity: 0.72; animation: hudAmbientSweep 14s linear infinite; }` → eliminar (la opacidad ya queda fija en la regla base de TICKET-06).
- `styles-v2.css:961-977` — bloque completo `@keyframes hudAmbientSweep` → eliminar.
- `styles-v2.css:953` — `.player-hud.motion-paused::before,` → eliminar esta línea del selector compuesto (dejar solo `.hud-avatar-ring`, `.flame-layer`, `.spark`, que sí siguen animando).
- `styles-v2.css:980` — `.player-hud.is-ready::before,` dentro del bloque `@media (prefers-reduced-motion: reduce)` → eliminar esta línea del selector (dejar solo `.filter-btn-gift.has-unclaimed`).
- `styles-v2.css:4186-4189` — comentario `/* Keep the ambient HUD diffusion affordable on touch hardware. */` y la regla `.player-hud::before { filter: blur(8px); }` dentro de `@media (pointer: coarse)` → eliminar por completo (ya no hay blur obligatorio que reducir en móvil).
- `app-v2.js:2492` — comentario `// Las dos animaciones son solo decorativas. Pausarlas fuera de la pestaña...` → actualizar el texto para que ya no diga "dos animaciones" (ahora son las del fuego/spark/avatar-ring); no requiere cambio funcional, solo de comentario.
- `DOCUMENTACION-v2.md` — añadir una entrada de changelog nueva (siguiendo el formato ya usado en la sección "2i. Novedades") que documente: qué existía (`hudAmbientSweep`), por qué se eliminó (banding persistente pese al blur + coste continuo de compositor en la pantalla de mayor duty-cycle de la app), y qué lo reemplaza (degradado estático + ruido, Sección 3 de este documento). Esto evita que un futuro mantenedor reintroduzca la animación sin conocer el historial.

**Implementación**
Aplicar cada eliminación/actualización de la lista de evidencia. No debe quedar ninguna referencia a `hudAmbientSweep` en el repositorio tras este ticket (verificable con una búsqueda de texto simple).

**Comportamiento esperado**
Ningún cambio visual respecto a TICKET-06 — este ticket es puramente de limpieza.

**Performance**
N/A (sin impacto de rendimiento adicional; confirma que no queda ningún residuo que pudiera reactivarse por error).

**Accesibilidad**
Confirmar que, tras retirar `.player-hud::before` de las listas de `motion-paused` y `prefers-reduced-motion`, ningún otro elemento quedó afectado por error (revisar que las comas y selectores restantes sigan siendo CSS válido).

**Cleanup**
Este ticket ES el cleanup.

**Criterios de aceptación**
- Búsqueda de texto `hudAmbientSweep` en todo el repositorio no devuelve resultados.
- `.player-hud.motion-paused` y el bloque `prefers-reduced-motion` siguen siendo válidos y siguen pausando correctamente `.flame-layer`, `.spark` y `.hud-avatar-ring`.
- `DOCUMENTACION.md` incluye la nueva entrada de changelog.

**Validación**
Grep del repositorio completo + revisión manual del diff final.

**Riesgos**
Ninguno relevante — es limpieza de referencias ya mapeadas exhaustivamente.

---

### TICKET-08 (Opcional) — Blur sutil puramente estético sobre el halo estático

- **Prioridad:** P2
- **Dependencias:** TICKET-06
- **Confianza:** Media (mejora cosmética, no corrige ningún defecto pendiente)

**Objetivo**
Evaluar si añadir un `filter: blur()` ligero (p. ej. 10-14px) sobre el nuevo `::before` estático mejora la sensación de "glow" premium de las dos manchas radiales, aprovechando que —al ser estático— el coste de ese blur se paga una sola vez y es efectivamente gratuito en cualquier dispositivo, incluida gama baja.

**Evidencia**
Sección 3.3 (nota sobre blur opcional).

**Implementación**
Añadir `filter: blur(12px)` (valor de partida, ajustable) directamente a `.player-hud::before` tal como quedó definido en TICKET-06. No requiere ninguna reducción específica para `pointer: coarse`: al no haber animación, el coste es el mismo en cualquier dispositivo.

**Comportamiento esperado**
Manchas de color con bordes más difusos y orgánicos, sin cambiar su posición ni el degradado lineal de base.

**Performance**
Coste único de rasterizado en el primer paint; sin coste recurrente al no haber animación.

**Accesibilidad**
Ninguna implicación.

**Cleanup**
N/A.

**Criterios de aceptación**
El blur no oculta ni difumina el ruido de dithering hasta el punto de perder su efecto anti-banding (verificar visualmente que ambos efectos siguen conviviendo).

**Validación**
Comparación visual A/B con y sin este ticket.

**Riesgos**
Un blur demasiado fuerte puede "lavar" el ruido de dithering y reintroducir banding en el centro de las manchas — si ocurre, reducir el radio de blur o subir ligeramente la opacidad del ruido.

---

### TICKET-09 — QA final de banding y performance sobre la implementación estática

- **Prioridad:** P1
- **Dependencias:** TICKET-06, TICKET-07 (y TICKET-08 si se adopta)
- **Confianza:** Alta (ticket de proceso)

**Objetivo**
Confirmar de forma definitiva que el banding desapareció y que el Player Hud ya no genera ningún trabajo de compositor continuo, cerrando el ciclo abierto por el reporte de banding persistente de esta ronda.

**Evidencia**
Todos los tickets de esta ronda.

**Implementación**
N/A — ticket de QA.

**Comportamiento esperado**
Ver criterios de aceptación combinados de TICKET-06 a TICKET-08.

**Performance**
- DevTools → *Rendering* → *Paint flashing*: confirmar que `.player-hud` no repinta espontáneamente tras el primer render (sin temporizador, sin scroll).
- DevTools → *Performance*: grabar 15s con el HUD visible e inactivo; el uso de GPU/CPU atribuible al HUD debería ser prácticamente nulo tras el primer paint (a diferencia de la versión animada, que sí mostraba trabajo continuo de compositor).
- Repetir en un dispositivo Android de gama baja real.

**Accesibilidad**
Confirmar que `prefers-reduced-motion` no rompe nada (no debería haber diferencia visible, ya que no hay animación que desactivar).

**Cleanup**
Confirmar que TICKET-07 se aplicó por completo (grep de `hudAmbientSweep` vacío).

**Criterios de aceptación**
- Cero banding perceptible a zoom ×4-8 en los 3 temas de prueba, en `::before` y `::after`.
- Cero actividad de compositor atribuible al Player Hud en una grabación de 15s sin interacción.
- Ninguna referencia residual a `hudAmbientSweep` en el repositorio.

**Validación**
Adjuntar capturas de zoom (antes/después) y grabación de perfil de rendimiento como evidencia de cierre.

**Riesgos**
Ninguno adicional a los ya listados en TICKET-06/08.
