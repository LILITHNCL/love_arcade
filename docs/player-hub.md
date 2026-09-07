# Especificación técnica/UX — Ambient Background del Player Hub (Daily Streak)

**Rol asumido:** Principal Product Designer + Game UX Designer + Frontend Architect + Performance Engineer
**Alcance:** Diagnóstico + solución + performance plan + tickets para Codex. Sin implementación.

---

## 0. Archivos analizados

| Archivo | Uso en este análisis |
|---|---|
| `index.html` | Estructura del Player Hub, `.streak-flame`, script crítico de temas (`T` map) |
| `styles.css` | `.player-hud`, `.player-hud::before/::after`, `@keyframes hudAmbientSweep`, sistema de tokens (`:root`), patrón `neonFlowDrift` / `.mockup-bg-offline`, reglas `pointer: coarse` |
| `app.js` | Ciclo de vida del HUD (`is-ready`, `motion-paused`), `visibilitychange`, `THEMES`/`applyTheme()` |
| `streak-hub.js` | Estado del fuego (`_syncFlameState`), audio y feedback de reclamo — no interviene en el fondo ambient |
| `DOCUMENTACION.md` | Precedente ya documentado de un fix de banding equivalente (`neonFlowDrift`) aplicado en otro componente |

No fue necesario solicitar archivos adicionales: el ambient background es 100% CSS (pseudo-elementos), y su único enganche en JS es la clase `is-ready`/`motion-paused`, ambas ya localizadas y comprendidas en `app.js`.

---

## 1. Diagnóstico

### 1.1 Qué existe actualmente (HECHO)

El fondo ambient del Player Hub es un único pseudo-elemento:

```css
/* styles.css:897-936 */
.player-hud {
    background: var(--solid-surface-float);   /* #141620 — styles.css:174 */
    overflow: hidden;
    position: relative;
    ...
}
.player-hud::before {
    content: '';
    position: absolute;
    inset: -35%;
    background:
        radial-gradient(circle at 20% 30%, var(--accent-soft), transparent 48%),
        radial-gradient(circle at 85% 72%, rgba(255,255,255,0.07), transparent 42%);
    opacity: 0;
    transform: translate3d(-6%, -2%, 0) rotate(0.001deg);
    will-change: transform, opacity;
}
.player-hud.is-ready::before {
    opacity: 0.72;
    animation: hudAmbientSweep 18s ease-in-out infinite alternate;
}
@keyframes hudAmbientSweep {
    0%   { transform: translate3d(-8%, -4%, 0) scale(1)    rotate(0.001deg); }
    50%  { transform: translate3d(5%,  -1%, 0) scale(1.03) rotate(0.001deg); }
    100% { transform: translate3d(8%,   3%, 0) scale(1.01) rotate(0.001deg); }
}
```

- `.player-hud::after` (styles.css:929-936) es una capa **separada y estática**: un `linear-gradient` de brillo superior, sin animación. No forma parte del problema y no debe tocarse.
- El único disparador JS es `app.js:2337-2342` (añade `.is-ready` cuando el HUD está listo para pintarse) y `app.js:2485-2502` (añade/quita `.motion-paused` en `visibilitychange`, pausando `::before`, `.hud-avatar-ring`, `.flame-layer` y `.spark` cuando la pestaña no es visible). **Esto ya está bien resuelto** — no requiere cambios.
- `prefers-reduced-motion: reduce` ya desactiva la animación del `::before` (styles.css:970-975). **Ya está bien resuelto.**
- No existe ningún `filter`, `blur` ni capa de dithering en `.player-hud::before` actualmente.
- No existe detección de capacidad de dispositivo vía JS (`hardwareConcurrency`, `deviceMemory`, `connection.saveData`, etc.) en todo el proyecto. Toda la degradación de gama baja existente se hace vía media queries CSS (`pointer: coarse`, `prefers-reduced-motion`), nunca vía JS runtime. Esto es una convención de arquitectura a respetar.
- El fuego de la racha (`.streak-flame`, index.html:339-368) anima tres capas SVG con duraciones escalonadas y distintas: `flameSwayBack` 3.4s, `flameSwayMid` 2.6s (delay -0.6s), `flameSwayCore` 1.9s (delay -1.1s) — styles.css:1268-1296. Esta es la referencia de cadencia del elemento protagonista.

### 1.2 Causa más probable del color banding (HECHO + INFERENCIA)

El `::before` del HUD combina tres factores que, juntos, son una receta clásica de banding en móvil:

1. **Superficie base casi negra** (`--solid-surface-float: #141620`, styles.css:174) — el ojo humano y la codificación no lineal de color son mucho más sensibles al banding en tonos oscuros que en tonos medios/claros.
2. **Gradiente muy sutil hacia `transparent`** sin ningún stop intermedio: `radial-gradient(circle at 20% 30%, var(--accent-soft), transparent 48%)`. `--accent-soft` (styles.css:154) es en sí mismo un color ya muy oscuro (`color-mix(in srgb, var(--accent) 28%, #0b0d14 72%)`), así que el salto perceptual entre el centro del gradiente y el borde es pequeño en términos absolutos — exactamente el escenario donde la cuantización a 8 bits por canal (o menor precisión de framebuffer compuesto en GPUs móviles) se hace visible como bandas discretas.
3. **Área enorme**: `inset: -35%` hace que el pseudo-elemento mida ~170% del contenedor en cada eje. Un gradiente sutil estirado sobre una superficie tan grande reduce aún más el número de pasos de color perceptualmente distintos por píxel, agravando el banding.

No hay blur, canvas ni filtros involucrados — es un caso puro de **interpolación de gradiente CSS + poca profundidad de color efectiva sobre negro**, no un problema de tamaño de componente ni de resolución de pantalla (consistente con lo que describe el ticket original).

**Evidencia interna que confirma el diagnóstico:** este mismo proyecto ya resolvió un problema idéntico en otro componente. `DOCUMENTACION.md:1000-1042` y su implementación real en `styles.css:3586-3628` (`.mockup-bg-offline::before`, animación `neonFlowDrift`) documentan explícitamente:

> *"`filter: blur(40px)` convierte los bordes duros del `conic-gradient` en difusión orgánica, eliminando el banding visible sin coste adicional de rasterizado... y permite un gradiente más simple (menos stops, menos rasterización)."*

Ese pseudo-elemento **no tiene banding** porque usa `filter: blur()`. El `.player-hud::before` del Daily Streak es funcionalmente análogo (pseudo-elemento sobredimensionado + gradiente + `transform` animado) pero **sin blur** — esa es la diferencia estructural que explica por qué uno banda y el otro no.

### 1.3 Causa de que el movimiento se perciba lento/poco vivo (HECHO)

- `animation: hudAmbientSweep 18s ease-in-out infinite alternate` → como es `alternate`, el ciclo real percibido es de **36 segundos** (ida + vuelta), no 18.
- Solo tiene **3 keyframes** (0/50/100%) con `ease-in-out`: esto genera una desaceleración marcada en ambos extremos del recorrido, por lo que el fondo "se queda quieto" perceptualmente durante buena parte del ciclo antes de invertir dirección.
- La amplitud es pequeña: traslación ±8% en X, -4%/+3% en Y, escala 1.00→1.03→1.01. Combinado con el ciclo largo, el resultado es un movimiento casi imperceptible salvo con atención sostenida — tal como describe el problema original.
- Por contraste, el elemento que sí debe sentirse vivo (el fuego) usa ciclos de 1.9–4.6s. La proporción actual entre fondo (36s) y fuego (~2–4.6s) es de ~8–18×, una jerarquía de velocidad correcta en principio, pero el fondo está tan por debajo del umbral de percepción que dejó de leerse como "vivo" y pasó a leerse como "estático".
- Nota curiosa (HECHO menor): el `rotate(0.001deg)` presente en todos los keyframes no tiene ningún efecto visual — es un valor de no-operación. Es probable (INFERENCIA) que se añadiera como técnica para forzar la promoción a capa GPU vía una propiedad de `transform` adicional, o sea un resto de una prueba anterior. No es dañino, pero tampoco aporta nada hoy.

### 1.4 Limitaciones técnicas relevantes (HECHO)

- `.player-hud` ya tiene `overflow: hidden`, por lo que cualquier pseudo-elemento sobredimensionado (incluido uno con blur, que necesita margen extra para no revelar bordes duros del blur) queda contenido sin tocar el layout — igual que en `.mockup-bg-offline`.
- No hay sistema de "device tier" en JS: cualquier degradación para gama baja debe resolverse con `@media (pointer: coarse)` y/o `@media (prefers-reduced-motion: reduce)`, replicando el patrón ya usado en `styles.css:4072-4176` (reducción de `blur(40px)` a `blur(12px)` en móvil, con una proporción de radio ~3.3× que documentan como ~11× menos coste de rasterizado, consistente con que el coste de un blur gaussiano escala aproximadamente con el cuadrado del radio).
- `backdrop-filter` está prohibido en `pointer: coarse` en todo el proyecto por coste de GPU (styles.css:4072-4100). **Esto no aplica aquí**: `filter: blur()` sobre un pseudo-elemento con contenido propio (un gradiente) es una operación distinta y mucho más barata que `backdrop-filter` (que debe capturar y desenfocar la escena real detrás en cada frame). El proyecto ya usa `filter: blur()` animado en producción (`neonFlowDrift`) sin la restricción que aplica a `backdrop-filter` — es importante no confundir ambas técnicas al escribir los tickets para Codex.
- Diferencia de contexto relevante para el performance plan: `.mockup-bg-offline` solo se activa cuando falla Cloudinary (caso de borde, poco frecuente). El ambient del Daily Streak está visible permanentemente en la pantalla de inicio, con sesiones potencialmente largas. Esto pesa a favor de ser algo más conservador con el radio de blur y la opacidad que en el caso del modal, y de mantener obligatoriamente el `motion-paused` ya existente.

---

## 2. Solución recomendada

### 2.1 Experiencia final

El fondo debe seguir siendo un halo ambiental de dos manchas de color (la actual composición violeta/blanco vía `--accent-soft`) que respira lentamente detrás del fuego, sin bordes duros ni bandas visibles, y con un recorrido de movimiento que **no se detenga perceptualmente** en ningún punto del ciclo. La jerarquía visual se mantiene: fondo (atmósfera, lento y difuso) → fuego (protagonista, cadencia 1.9–4.6s) → número de racha → texto/CTA de reclamo.

### 2.2 Técnica para el banding — reutilizar el patrón ya existente en el proyecto

Aplicar `filter: blur()` al `::before` existente, exactamente como en `.mockup-bg-offline::before`. No se introduce ninguna dependencia ni técnica nueva: es la misma solución que el propio proyecto ya validó y tiene en producción.

- Blur en desktop: partir de un radio moderado (recomendado ~24–28px) — más bajo que los 40px del modal porque la superficie del HUD es mucho más pequeña que un modal de preview (más cercana en escala a las cards de catálogo, que usan 30px).
- Blur en `pointer: coarse` (móvil): aplicar la misma proporción de reducción que ya está documentada y en producción (~3.3× menos radio ⇒ ~11× menos coste), lo que da un valor orientativo de ~8px. El valor exacto debe confirmarse con profiling real (ver Sección 3), no es un número cerrado.
- Mantener menos stops en el gradiente (ya los tiene: solo color → transparent), confiando en el blur para la suavidad, tal como razona `DOCUMENTACION.md:1042`.
- **Refuerzo opcional de bajo coste** (solo si QA todavía detecta banding perceptible tras el blur en algún dispositivo): añadir la capa de ruido SVG data-URI que el proyecto ya usa en `styles.css:3701` y `styles.css:3717` (`feTurbulence`, sin petición HTTP, `background-image` estático, coste de GPU insignificante). Aunque en el proyecto esa capa se documenta con fin "anti-extracción", su efecto de dithering es idéntico al que se necesitaría aquí. No implementar esto por defecto — es un fallback de QA, no un requisito de diseño.

### 2.3 Técnica para el motion — mismo principio que `neonFlowDrift`, aplicado al gradiente existente

`neonFlowDrift` (styles.css:3630-3640) ya resuelve exactamente este problema en otro componente: usa `translate + rotate`, timing `linear` (no `ease-in-out`) y **no** usa `alternate` — usa un bucle cerrado de 5 keyframes (0/25/50/75/100%) que vuelve suavemente a su posición inicial, eliminando la sensación de "pausa y rebote" que sí tiene `hudAmbientSweep`.

Se recomienda:

- Eliminar `alternate` y sustituir los 3 keyframes por un bucle cerrado de 4–6 puntos (mismo principio que `neonFlowDrift`), de modo que las dos manchas del `radial-gradient` describan una órbita continua entre sí en vez de un vaivén.
- Cambiar el *easing* a `linear` (o un cubic-bezier sin reposo en los extremos), por la misma razón que documenta el propio proyecto: *"linear evita aceleración/desaceleración que delate el bucle"* (styles.css:3632-3633).
- Acortar la duración de un ciclo completo: como ya no habrá `alternate`, un solo ciclo de **~14s** produce un ritmo perceptivamente más rápido que el actual "36s de ida y vuelta", sin acercarse a la cadencia del fuego (1.9–4.6s). Regla de proporción propuesta: mantener el ciclo del fondo en **al menos 3× la duración del layer más rápido del fuego** (`flameSwayCore`, 1.9s) para preservar la jerarquía "atmósfera, no protagonista"; 14s cumple esa regla con amplio margen (~7.4×) y es sensiblemente más vivo que 36s.
- Aumentar ligeramente la amplitud: traslación a un rango de ~±12–14% (desde ±8%) y escala a 1.00–1.05 (desde 1.00–1.03). Es un ajuste moderado, no un cambio de escala del efecto.
- Decidir sobre el `rotate(0.001deg)` actual: o se elimina (si no cumple ninguna función real) o se amplifica intencionalmente a ~1–2° dentro del bucle, para que las dos manchas de color roten ligeramente una respecto a la otra — mismo recurso que usa `neonFlowDrift` (`rotate(0deg → 360deg)`) para dar sensación orgánica sin cambiar el gradiente en sí. Cualquiera de las dos opciones es aceptable; lo que no debe quedar es un valor "fantasma" que no hace nada ni se documenta.

### 2.4 Alternativas descartadas (y por qué)

- **Canvas/WebGL para el ambient**: descartado. Introduce una dependencia de renderizado completamente nueva para un efecto que el propio CSS del proyecto ya resuelve en otro lugar con `filter: blur()`. Viola el principio de "usa primero la arquitectura existente".
- **Añadir más `radial-gradient` stops en vez de blur**: descartado como solución principal. No resuelve la causa raíz (precisión de color/compositing sobre negro), solo la mitiga marginalmente, y añade más trabajo de rasterización por cada frame sin abordar el problema de fondo. El propio proyecto ya llegó a esta misma conclusión en `neonFlowDrift` ("menos stops, menos rasterización" + blur).
- **`backdrop-filter` para el efecto de halo**: descartado explícitamente. Es la técnica que el proyecto ya prohíbe en `pointer: coarse` por coste de GPU (styles.css:4072-4100); no debe confundirse con `filter: blur()`, que es la técnica correcta y ya en uso.
- **Segunda capa de gradiente independiente (dos manchas con fases distintas en pseudo-elementos separados) para más "juice"**: no descartada del todo, pero degradada a mejora opcional (ver TICKET-04) porque `::after` ya está ocupado por el sheen estático y añadir un nuevo elemento con su propio blur duplicaría el coste de rasterizado en una pantalla que está visible permanentemente. Se recomienda medir primero el impacto de la solución base (2.2 + 2.3) antes de invertir en esto.

---

## 3. Performance plan

- **Presupuesto de rendimiento:** el objetivo es que la animación del `::before` se ejecute enteramente en el hilo de composición (GPU) — igual que hoy — y que el coste del `filter: blur()` se pague **una sola vez** al crear/redimensionar la capa, no en cada frame, tal como ya ocurre con `neonFlowDrift` en producción. No se fija un número de milisegundos "inventado": ese dato debe salir del profiling real descrito abajo, comparándolo contra el coste ya medido y aceptado de `neonFlowDrift` como referencia de lo que el proyecto considera "seguro" para gama baja.
- **Estrategia low-end:** sin detección de dispositivo en JS (no existe en el proyecto y no debe introducirse solo para esto). Toda la degradación va por CSS:
  - `@media (pointer: coarse)`: reducir el radio de blur siguiendo la misma proporción ya usada en `styles.css:4168-4175`.
  - `@media (prefers-reduced-motion: reduce)`: ya pausa la animación (no requiere cambios), pero debe verificarse que sigue apuntando al selector correcto tras el rediseño de keyframes.
- **Reducción de efectos:** si tras medir en un dispositivo de gama baja real el coste sigue siendo alto, la primera palanca es bajar opacidad/blur antes que eliminar el movimiento — el movimiento (transform puro) es la parte más barata del efecto; el blur es la parte cara.
- **`prefers-reduced-motion`:** mantener el comportamiento actual (animación en pausa, gradiente estático visible) — no ocultar el fondo por completo, solo congelarlo, tal como ya se hace.
- **Visibility / background tab:** ya resuelto por `motion-paused` (`app.js:2485-2502`). El nuevo diseño debe seguir usando ese mismo hook — si se añade una capa nueva (TICKET-04, opcional), debe incluirse explícitamente en el selector de `motion-paused` (styles.css:951-956) y en el de `prefers-reduced-motion` (styles.css:970-975).
- **Batería:** al ser una animación puramente de compositor y ya pausada en segundo plano, el impacto adicional de batería debería ser marginal frente al estado actual; esto debe confirmarse en la validación, no asumirse.
- **Criterios de profiling y QA:**
  1. Chrome DevTools → *Rendering* → activar *Paint flashing* y *Layer borders*: confirmar que el `::before` se pinta como capa independiente y que **no repinta en cada frame** de la animación (solo transform).
  2. DevTools → *Performance*: grabar 10s con el HUD visible, comparar % de tiempo en GPU vs. main thread antes/después del cambio.
  3. Repetir la misma prueba en un dispositivo Android de gama baja real (no solo emulación de CPU throttling), dado que el HUD es visible permanentemente y no un caso de borde.
  4. Inspección visual de banding en captura de pantalla ampliada (zoom ×4–8) sobre el área del gradiente, en al menos un tema oscuro y uno con acento claro (`white`/`gold_soft`) del mapa de temas (`index.html:43`), ya que `--accent-soft` cambia con el tema.
  5. Confirmar visualmente que `motion-paused` y `prefers-reduced-motion` siguen deteniendo *toda* capa nueva que se añada.

---

## 4. Tickets para Codex

### TICKET-01 — Eliminar el color banding del ambient background del Player Hud

- **Prioridad:** P0
- **Dependencias:** Ninguna
- **Confianza:** Alta (causa raíz confirmada por comparación directa con un fix idéntico ya en producción en el mismo repositorio)

**Objetivo**
Eliminar el banding visible en el `radial-gradient` de `.player-hud::before` sin cambiar la paleta de colores ni el sistema de temas.

**Evidencia**
- `styles.css:916-927` (`.player-hud::before`, gradiente sin blur).
- `styles.css:154` (`--accent-soft`, color ya muy oscuro sobre base `#141620`).
- `styles.css:3605-3628` y `DOCUMENTACION.md:1000-1042` (`.mockup-bg-offline::before` / `neonFlowDrift`: mismo tipo de pseudo-elemento, con `filter: blur(40px)`, sin banding, ya en producción).
- `styles.css:4168-4176` (proporción de reducción de blur ya usada en `pointer: coarse`).

**Implementación**
Añadir `filter: blur(<radio>)` a `.player-hud::before`, siguiendo el mismo patrón arquitectónico que `.mockup-bg-offline::before`: el pseudo-elemento sigue conteniendo el gradiente y solo se anima vía `transform` (ver TICKET-02), por lo que el blur se rasteriza una vez y no se recalcula por frame. Ajustar el `inset` si es necesario para que el margen de sobredimensionado siga ocultando el borde difuminado del blur (el `overflow: hidden` de `.player-hud` ya contiene cualquier desbordamiento).

**Comportamiento esperado**
El halo se percibe como una difusión orgánica continua, sin escalones de color visibles, sobre fondo oscuro y con acentos de cualquier tema del mapa `THEMES`.

**Performance**
- Blur debe aplicarse solo una vez por creación/resize de capa, no por frame (verificar con *Paint flashing*).
- Radio de blur reducido en `@media (pointer: coarse)` siguiendo la proporción ~3.3× radio / ~11× coste ya documentada en el proyecto.

**Accesibilidad**
Ninguna implicación directa; el elemento ya es `pointer-events: none` y decorativo.

**Cleanup**
Ninguno — es una adición pura sobre una regla existente.

**Criterios de aceptación**
- No se percibe banding a zoom ×4–8 en captura de pantalla, en al menos 2 temas (uno oscuro puro tipo `violet`, uno claro tipo `white`).
- El gradiente conserva sus dos manchas de color y su posición relativa.
- No aparecen bordes duros ni "halo cuadrado" visible por el `blur` en los límites del `.player-hud`.

**Validación**
Inspección visual ampliada + DevTools *Layers*/*Paint flashing* según Sección 3.

**Riesgos**
- Un radio de blur mal calibrado puede difuminar demasiado el halo y perderlo dentro del fondo oscuro — ajustar opacidad si es necesario.
- En GPUs muy antiguas, un blur mal dimensionado en desktop podría no reducirse automáticamente (la reducción vía `pointer: coarse` no cubre laptops de gama baja con mouse); si QA lo detecta, considerar una segunda reducción para pantallas pequeñas sin puntero táctil.

---

### TICKET-02 — Rediseño del motion del ambient background ("juice" sin competir con el fuego)

- **Prioridad:** P0
- **Dependencias:** Ninguna funcionalmente, pero modifica el mismo bloque CSS que TICKET-01 (`.player-hud::before` / `@keyframes hudAmbientSweep`) — se recomienda implementar en el mismo PR para evitar conflictos de merge.
- **Confianza:** Alta (causa del "movimiento lento" confirmada matemáticamente: `alternate` duplica el ciclo real a 36s; precedente de solución — `neonFlowDrift` — ya en producción)

**Objetivo**
Hacer que el movimiento del ambient background se perciba vivo y continuo, manteniéndolo claramente subordinado al fuego de la racha.

**Evidencia**
- `styles.css:945-968` (`hudAmbientSweep`, 3 keyframes, `ease-in-out`, `alternate`, amplitud pequeña).
- `styles.css:1268-1296` (cadencia de referencia del fuego: 1.9–4.6s).
- `styles.css:3630-3640` (`neonFlowDrift`: bucle cerrado, `linear`, sin `alternate` — patrón a replicar).

**Implementación**
- Quitar `alternate` de la declaración de `animation` en `.player-hud.is-ready::before`.
- Sustituir los keyframes de `hudAmbientSweep` por un bucle cerrado de 4–6 puntos (0/25/50/75/100% o similar) que termine en el mismo estado en que empieza.
- Cambiar el *easing* a `linear` (o cubic-bezier sin reposo en los extremos).
- Duración recomendada del ciclo completo: ~14s (ver justificación de proporción en Sección 2.3).
- Ampliar la amplitud de `translate3d` a ~±12–14% y de `scale` a 1.00–1.05.
- Decidir el destino del `rotate(0.001deg)` actual: eliminarlo o amplificarlo intencionalmente (~1–2°) dentro del bucle.

**Comportamiento esperado**
El halo se percibe en movimiento constante sin pausas ni "rebotes" apreciables, manteniendo un ritmo claramente más lento que el fuego (regla: ciclo del fondo ≥ 3× la duración del layer más rápido del fuego).

**Performance**
Sin cambios de coste relevantes: sigue siendo únicamente `transform` (compositor puro); no se añade ninguna propiedad nueva que dispare layout o paint por frame.

**Accesibilidad**
`prefers-reduced-motion: reduce` debe seguir pausando la animación resultante — verificar que el selector `styles.css:970-975` sigue aplicando tras el rediseño de keyframes (el nombre del keyframe puede cambiar; el selector de pausa no depende del nombre, pero conviene revisarlo).

**Cleanup**
Si se decide eliminar `rotate(0.001deg)`, quitarlo de los tres (ahora más) keyframes para no dejar código muerto.

**Criterios de aceptación**
- El ciclo completo de movimiento dura ~14s (no 36s) y no usa `alternate`.
- El movimiento no muestra un punto de pausa perceptible en ningún momento del ciclo.
- El fuego sigue siendo el elemento con la cadencia más rápida y perceptible de la pantalla; en una grabación de 20s, un observador no familiarizado con el sistema debe poder identificar el fuego como "lo que más se mueve" antes que el fondo.

**Validación**
Revisión visual comparativa (antes/después) + medición de duración real del ciclo en DevTools *Animations* panel.

**Riesgos**
- Si la amplitud se sube demasiado, el fondo puede empezar a "gritar" y competir con el fuego — validar contra el objetivo de diseño (Sección "OBJETIVO DE DISEÑO" del brief original) antes de cerrar el ticket.

---

### TICKET-03 — Verificación y ajuste de degradación para gama baja tras TICKET-01/02

- **Prioridad:** P1
- **Dependencias:** TICKET-01, TICKET-02
- **Confianza:** Media (los mecanismos de degradación ya existen y están probados en otro componente; lo que falta es aplicarlos y medirlos específicamente aquí)

**Objetivo**
Asegurar que el nuevo `filter: blur()` + motion rediseñado no degrade el frame rate en dispositivos Android de gama baja, replicando la estrategia de reducción ya validada en el proyecto.

**Evidencia**
- `styles.css:4072-4100` (regla `pointer: coarse`, restricción de `backdrop-filter` — para diferenciar explícitamente de `filter: blur()`, que sí se permite).
- `styles.css:4163-4175` (reducción de blur ya aplicada a `.mockup-bg-loading` y `.mockup-bg-offline::before` bajo `pointer: coarse`, con su justificación de coste).

**Implementación**
Añadir, dentro del bloque `@media (pointer: coarse)` ya existente en el proyecto (styles.css:4084 en adelante), una regla que reduzca el radio de blur de `.player-hud::before` siguiendo la misma proporción (~3.3× menos radio) usada para `.mockup-bg-offline::before`.

**Comportamiento esperado**
En dispositivos táctiles/gama baja, el halo se ve ligeramente menos difuminado pero sin banding perceptible y sin caída de frame rate.

**Performance**
Confirmar mediante profiling real (Sección 3) que el ajuste es suficiente; si no lo es, la siguiente palanca es opacidad, no eliminar el movimiento (que ya es barato).

**Accesibilidad**
Sin cambios adicionales a los ya cubiertos por TICKET-01/02.

**Cleanup**
Ninguno.

**Criterios de aceptación**
- El radio de blur en `pointer: coarse` es visiblemente menor que en desktop, sin reintroducir banding.
- No hay caída de frame rate medible en el HUD respecto al estado actual (antes de TICKET-01/02) en un dispositivo de gama baja real.

**Validación**
Profiling en dispositivo real de gama baja, según pasos 1–3 de la Sección 3.

**Riesgos**
Si el valor de blur reducido reintroduce banding visible en pantallas OLED de gama baja (que suelen acentuar el banding en negros), puede ser necesario activar el refuerzo de ruido SVG mencionado en 2.2 específicamente para `pointer: coarse`.

---

### TICKET-04 (Opcional) — Segunda capa de profundidad para el ambient background

- **Prioridad:** P2
- **Dependencias:** TICKET-01, TICKET-02 (medir su impacto en producción antes de evaluar este ticket)
- **Confianza:** Media-baja (es una mejora de "juice" adicional, no una corrección de un defecto; su relación coste/beneficio depende de los resultados de TICKET-01/02)

**Objetivo**
Evaluar si vale la pena añadir una segunda mancha de luz con fase/velocidad distinta (mismo principio de capas escalonadas que ya usa el fuego: `flameSwayBack/Mid/Core` con duraciones distintas) para dar aún más sensación de profundidad orgánica al ambient background.

**Evidencia**
- `styles.css:1268-1296` (patrón de capas con duraciones distintas, ya probado en el fuego).
- `styles.css:929-936` (`::after` ya ocupado por el sheen estático — no disponible para esto).

**Implementación**
Si se decide seguir adelante: añadir un elemento hijo decorativo dentro de `.player-hud` (no un pseudo-elemento, porque `::after` está ocupado), `aria-hidden="true"`, `pointer-events: none`, con su propio gradiente y su propio `filter: blur()` y animación con duración/fase distintas a las de TICKET-02.

**Comportamiento esperado**
Dos manchas de luz que se mueven a ritmos ligeramente distintos, reforzando la sensación de profundidad sin que ninguna compita con el fuego.

**Performance**
Este ticket **duplica el coste de blur** en una pantalla visible permanentemente — no implementar sin antes medir el coste de TICKET-01/02 en gama baja. Si el presupuesto ya está ajustado, no proceder.

**Accesibilidad**
La nueva capa debe añadirse explícitamente a los selectores de `motion-paused` (styles.css:951-956) y `prefers-reduced-motion` (styles.css:970-975); de lo contrario quedará animándose fuera de pestaña o con la preferencia de accesibilidad activa.

**Cleanup**
N/A (es una adición nueva).

**Criterios de aceptación**
- La capa nueva se pausa correctamente en ambos escenarios de accesibilidad/visibilidad.
- El coste de rasterizado adicional medido en gama baja permanece dentro del mismo orden de magnitud que TICKET-01 (no lo duplica en la práctica gracias a un radio de blur menor en esta segunda capa).

**Validación**
Mismo procedimiento de profiling que TICKET-03, comparando específicamente contra la versión sin esta capa.

**Riesgos**
Coste de GPU acumulado en dispositivos de gama baja; posible sensación de "demasiado movimiento" que rompa el objetivo de "atmósfera, no protagonista".

---

### TICKET-05 — Validación final end-to-end y QA de regresión

- **Prioridad:** P2
- **Dependencias:** TICKET-01, TICKET-02, TICKET-03 (y TICKET-04 si se implementa)
- **Confianza:** Alta (es un ticket de proceso, no de diseño)

**Objetivo**
Confirmar que el conjunto de cambios cumple el objetivo de diseño original sin regresiones de performance ni accesibilidad.

**Evidencia**
Todos los tickets anteriores.

**Implementación**
N/A — ticket de QA.

**Comportamiento esperado**
Ver criterios de aceptación de cada ticket individual, verificados en conjunto.

**Performance**
Ejecutar los 5 pasos de profiling de la Sección 3 sobre el resultado final combinado (no solo por ticket aislado).

**Accesibilidad**
Verificar `prefers-reduced-motion` y `motion-paused` sobre el resultado final combinado.

**Cleanup**
Confirmar que no queda código muerto (p. ej. el `rotate(0.001deg)` si se decidió eliminarlo en TICKET-02).

**Criterios de aceptación**
- Todos los criterios de aceptación de TICKET-01 a TICKET-04 (si aplica) se cumplen simultáneamente.
- No hay regresión de frame rate en el Player Hud respecto a la medición base tomada antes de estos cambios.

**Validación**
Grabación de video antes/después en un dispositivo de gama baja real + captura de zoom para banding, adjuntas como evidencia del cierre del ticket.

**Riesgos**
Ninguno adicional a los ya listados por ticket individual.
