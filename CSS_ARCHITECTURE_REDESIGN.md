# Auditoría, modernización y rediseño de la arquitectura CSS — Love Arcade (v2)

**Qué cambia respecto a v1:** este documento conserva íntegramente el diagnóstico, la arquitectura objetivo y la mayoría de los tickets de v1 (auditoría original: `styles.css` monolítico de ~2000 líneas, 21 problemas identificados, arquitectura de 34 archivos con `@layer`). Corrige tres cosas que v1 tenía mal para un entorno de ejecución 100% agente-sin-navegador:

1. **Secuencia de assembly rota.** v1 hacía que TICKET-001 ejecutara el build script contra la ruta real `styles.css`, lo que sobrescribiría el archivo de producción con contenido casi vacío antes de que TICKET-002 a TICKET-007 migraran nada. v2 introduce una fase de "build en sombra" (verificación contra una ruta temporal) durante 001-006, y un único ticket de corte (**TICKET-007B**) que genera y commitea `styles.css` por primera vez, solo cuando el 100% del contenido ya vive en `styles/`.
2. **Validación 100% no visual.** Toda instrucción de v1 que pedía capturas de pantalla, comparación visual o "adjuntar captura al PR" se elimina o se reemplaza por verificación estructural ejecutable por el agente: grep, diff semántico de declaraciones (`scripts/compare-css.mjs`, nuevo), y auditoría cruzada CSS↔HTML↔JS. Donde v1 dependía solo de "mirar", v2 exige lectura de código dirigida y documentación explícita del razonamiento en el PR. Cualquier verificación visual real queda marcada como **revisión humana posterior, no bloqueante**, y nunca como criterio de aceptación del agente.
3. **Contexto de branch correcto.** Todas las referencias a `main` se reformulan como "el estado de `styles.css` al inicio de esta branch de modularización". Nada de este plan asume ni pide que el trabajo ocurra sobre `main`.

Además se resuelve una inconsistencia de v1: TICKET-009 afirmaba "8 selectores `#view-profile .clase`" pero el documento solo respaldaba 4 con evidencia nombrada. v2 marca ese número como **hipótesis a confirmar por grep al inicio del ticket**, no como hecho.

**Alcance de esta auditoría:** inspección de solo lectura de todos los archivos provistos (`styles.css`, `index.html`, `js/**`, `tests/**`, `docs/**`, `.agents/skills/**`, `vercel.json`, `sw.js`, `manifest.webmanifest`). No se modificó el repositorio en la fase de auditoría. Toda validación descrita es un plan con comandos reales del proyecto, no un resultado ya ejecutado.

**Clasificación epistémica (aplica a todo el documento):** cada afirmación cae en una de estas categorías. Un agente que implemente un ticket debe respetar esta distinción y nunca ascender una fila a la de arriba sin evidencia nueva:
- **Hecho comprobado**: verificado por lectura directa del código citado en este documento.
- **Requisito**: instrucción obligatoria del encargo o derivada directamente de un hecho comprobado.
- **Propuesta de implementación**: cómo se sugiere resolver un requisito; el agente puede ajustar el detalle si encuentra algo que este documento no previó, documentando por qué.
- **Hipótesis**: afirmación que este documento no pudo verificar al 100% y que el ticket correspondiente debe reconfirmar con un comando antes de actuar (ver TICKET-009, TICKET-013).
- **Decisión delegada al agente**: casos donde el propio documento delega el criterio (p. ej. "si el nodo es único, fusionar; si es reutilizado, crear modificador").
- **Validación posterior**: cualquier chequeo que requiera ojos humanos o navegador; se documenta pero **nunca bloquea** el cierre de un ticket por parte del agente.

---

## 1. Resumen ejecutivo

`styles.css` es hoy un archivo único de ~2000 líneas que mezcla tokens, reset, layout, ~30 componentes/features y overrides, sin separación física ni cascada nativa: el orden de prioridad depende exclusivamente de la posición física de cada regla en el archivo. El repositorio no tiene bundler, `package.json`, preprocesador, linter de CSS ni CI. Cinco tests estáticos (`tests/*-static-qa.mjs`) hacen `assert.match()` con regex literales contra el contenido de `styles.css`.

**Decisión de arquitectura (sin cambios respecto a v1):** árbol de 34 archivos organizados por responsabilidad (`tokens/`, `base/`, `layout/`, `components/`, `features/<subsistema>/`, `utilities/`, `overrides/`), cascada controlada por `@layer` nativo, ensamblado mediante `scripts/build-css.mjs` (Node puro, cero dependencias npm) en vez de `@import` en runtime (justificación de rendimiento zero-flicker sin cambios, ver §13).

Se identifican y se planifica corregir 21 problemas arquitectónicos reales (tabla en §4).

---

## 2. Repositorio y archivos inspeccionados

Sin cambios respecto a v1. Ver Anexo A al final de este documento si se necesita el detalle completo de rutas inspeccionadas; se omite aquí para no repetir contenido que no afecta la ejecución de los tickets.

**Ausencias verificadas:** no existe `package.json`, no existe configuración de Sass/PostCSS/Stylelint/ESLint/TypeScript, no existe `.github/workflows` ni ningún otro CI, no existe test E2E ni de regresión visual, no existe `browserslist` declarado.

---

## 3. Contrato verificado con HTML/JS (hecho comprobado, no se toca)

- `js/domain/theming.js` escribe `--accent`, `--accent-hover`, `--accent-glow`, `--accent-dim`, `--accent-soft`, `--accent-soft-strong`, `--accent-border`, `--surface-nav`, `--on-accent` vía `style.setProperty()`, y alterna `body.classList` con `theme-<key>`.
- El script crítico inline en `<head>` de `index.html` reimplementa `deriveThemeRoles` en JS puro para pintar el tema antes del primer frame (zero-flicker). `tests/player-hud-static-qa.mjs` verifica que ese mapa coincida con `THEMES` de `js/core/config.js` — **esta duplicación es intencional y no se toca**.
- `js/spa-router.js`, `js/shop-logic.js`, `js/streak-hub.js`, `js/ui/hud-render.js`, `js/cloud/sentinel.js` manipulan `classList`, `dataset.state/theme/itemId/aspectRatio`, `style.setProperty('--coin-x', ...)`, `style.aspectRatio`, y generan `className` por template string.
- IDs singleton referenciados por `getElementById`: `#btn-daily`, `#streak-flame`, `#daily-msg`, `#countdown-display`, `#shop-container`, `#view-home`, `#view-shop`, `#view-profile`, `#theme-grid`, `#confirm-modal`, `#preview-modal`, `#identity-modal`, `#profile-edit-modal`, `#cloud-gatekeeper-modal`, `#daily-repair-modal`, entre otros.

Ningún selector se marca "muerto" sin verificación cruzada contra este contrato.

---

## 4. Problemas arquitectónicos encontrados

| # | Categoría | Problema | Severidad |
|---|---|---|---|
| 1 | Organización | Un único archivo mezcla 8 niveles de abstracción distintos | Alta |
| 2 | Cascada | Prioridad determinada por posición física, no declarada (sin `@layer`) | Alta |
| 3 | Especificidad | IDs usados como selector de estilo, no solo de enganche JS | Media |
| 4 | Especificidad/Acoplamiento | Override de componente compartido por ID de vista (`#view-profile .clase`) | Alta |
| 5 | Duplicación | Tokens `--glass-*` (9 variables) marcados "legacy" sin verificación de uso | Media |
| 6 | Duplicación | `prefers-reduced-motion` en bloque global + 4 overrides locales sin criterio documentado | Media |
| 7 | Duplicación | `pointer: coarse` en un bloque único que toca 4 componentes de features distintas | Media-Alta |
| 8 | Tokens | Z-index sin escala nombrada (`1000`/`9999`/`10000`/`10500` literales) | Media-Alta |
| 9 | Responsive | Breakpoint `720px` usado en 3 sitios vs `768px` dominante en el resto | Media |
| 10 | Nomenclatura | Convención mixta BEM/plana sin guía documentada | Media |
| 11 | `!important` | 9 apariciones sin política, mezclando usos legítimos con usos síntoma | Media |
| 12 | Acoplamiento JS/CSS | Contrato de variables CSS escritas desde JS no documentado | Media |
| 13 | Stacking | `will-change`/`translateZ(0)` en 6 sitios sin política única (no se toca, ya justificado localmente) | Baja-Media |
| 14 | Tooling | Cero lint/validación automática de CSS | Media |
| 15 | Documentación | No existe documento de arquitectura CSS en `docs/` | Alta |
| 16 | Infraestructura | `Cache-Control` de `.css` no alineado con `.js` en `vercel.json` | Media |
| 17 | Cascada/Especificidad | Reglas-override mezcladas sin marcar con reglas estructurales | Media |
| 18 | Acoplamiento HTML/CSS | Selectores frágiles por DOM accidental (`.icon + span`) — no se toca, bajo impacto | Baja |
| 19 | Animaciones | `@keyframes shake` y `shakeX` duplicados conceptualmente | Baja-Media |
| 20 | Auditabilidad/IA | Nada indica a un agente dónde vive un componente salvo comentarios no accionables | Alta |
| 21 | Escalabilidad | Crecimiento lineal sin límite natural (~2000 líneas para ~10 features) | Alta |

**Nota sobre lo que NO se marca como problema:** `:where(...)` en micro-interacciones, `color-mix()` para variantes de tokens, `data-*` para estados >2 valores, y media queries co-locadas por componente son decisiones **correctas**; se formalizan, no se "arreglan".

Evidencia detallada de cada fila: sin cambios respecto a v1 (ver Anexo B).

---

## 5. Arquitectura CSS objetivo

### 5.1 Estructura de directorios (34 archivos, sin cambios respecto a v1)

```
styles/
├── tokens/
│   ├── 01-colors.css
│   ├── 02-typography.css
│   ├── 03-spacing-layout.css
│   ├── 04-motion.css
│   ├── 05-shadow.css
│   └── 06-z-index.css
├── base/
│   ├── 01-reset.css
│   ├── 02-document.css
│   └── 03-icons.css
├── layout/
│   ├── container.css
│   ├── navbar.css
│   ├── pill-nav.css
│   └── view-transitions.css
├── components/
│   ├── buttons.css
│   ├── interactive-states.css
│   ├── glass-panel.css
│   ├── modal-base.css
│   ├── toast.css
│   ├── feedback-msg.css
│   ├── theme-picker.css
│   ├── coin-badge.css
│   ├── avatar.css
│   ├── history-list.css
│   ├── economy-info.css
│   └── shake.css
├── features/
│   ├── home/
│   │   ├── player-hud.css
│   │   ├── daily-streak-hub.css
│   │   └── daily-repair-modal.css
│   ├── games/
│   │   └── game-cards.css
│   ├── shop/
│   │   ├── shop-grid.css
│   │   ├── shop-collection.css
│   │   ├── shop-error-state.css
│   │   └── shop-preview-modal.css
│   ├── profile/
│   │   ├── profile-hub.css
│   │   ├── profile-screens.css
│   │   ├── profile-edit-modal.css
│   │   ├── promo-code-form.css
│   │   ├── moon-blessing.css
│   │   ├── sync-cards.css
│   │   └── cloud-gatekeeper.css
│   └── onboarding/
│       └── identity-modal.css
├── utilities/
│   └── visibility.css
└── overrides/
    ├── reduced-motion.css
    └── touch.css
```

34 archivos, 20-150 líneas cada uno. Responsabilidad y dependencias permitidas por directorio: sin cambios respecto a v1 (Anexo C). Criterio de 7 preguntas para código nuevo: sin cambios respecto a v1 (Anexo C).

### 5.2 Reglas arquitectónicas (sin cambios de fondo respecto a v1)

- **Dependencias, dirección única:** `tokens → base → layout → components → features (sin cruce entre subsistemas) → utilities → overrides`. Hecho ejecutable por `@layer` + orden del build script, no solo documental.
- **Especificidad:** máximo 1 clase + 1 pseudo-clase/atributo fuera de `overrides/`. IDs solo si son enganche real de `getElementById`.
- **`!important`:** solo permitido en `utilities/visibility.css` y `overrides/reduced-motion.css` (4 usos totales tras la migración, frente a 9 hoy). Ver tabla completa en §11.
- **Tokens:** globales/semánticos en `tokens/`; de componente (`--coin-x`, `--flame-glow-*`, etc.) documentados como "API de JS" en cabecera del archivo que los declara. Regla operativa: valor repetido ≥2 veces → token; valor de un solo uso → literal.
- **Responsive:** mobile-first, co-locado por componente (no en carpeta `responsive/` separada). Breakpoints consolidados: `379px` (max), `640px`, `768px`, `1024px`. El `720px` histórico se sube a `768px`.
- **Z-index:** escala nombrada en `tokens/06-z-index.css`:
  ```
  --z-base: 0;
  --z-sticky-nav: 1000;
  --z-toast: 9999;
  --z-modal: 10000;
  --z-modal-priority: 10500;
  ```
- **Estados:** pseudo-clases nativas para interacción; `[data-state]` para negocio con >2 valores; `.is-*` para booleano; `.componente--variante` para variante fija (nunca `#vista .componente`).

---

## 6. Estrategia de cascada

**Decisión: `@layer` nativo.** Justificación sin cambios respecto a v1 (el proyecto ya usa `color-mix()`, `:has()`, `@supports` sin fallback declarado; `@layer` resuelve de raíz el problema de "override por ID de vista"; sin `@layer`, 34 archivos solo repartirían el mismo problema de orden posicional).

```css
@layer tokens, base, layout, components, features, utilities, overrides;
```

Declarado una sola vez en la cabecera del `styles.css` generado. Cada archivo fuente no declara su propio `@layer`; el build script envuelve el contenido de cada directorio automáticamente.

---

## 7. Estrategia de ensamblado — **corregida (punto crítico de v2)**

**Decisión: script de build determinista, sin dependencias npm, en Node puro (`scripts/build-css.mjs`).** Por qué no `@import` en runtime: sin cambios respecto a v1 — `@import` obligaría al navegador a descargar y parsear el `styles.css` raíz antes de descubrir cada archivo importado, contradiciendo la cultura de rendimiento "Zero-Flicker" ya documentada en el propio código (`index.html`, `js/ui/hud-render.js`).

### 7.1 Comportamiento del script

Recorre `styles/<capa>/` en el orden de §6, concatena el contenido de cada archivo dentro de esa capa (orden alfabético; `tokens/`/`base/` ya llevan prefijo numérico), envuelve el resultado de cada capa en `@layer <nombre> { ... }`, y escribe el resultado precedido por la declaración de capas y un comentario `/* GENERADO — no editar a mano, ver styles/ y scripts/build-css.mjs */`.

El script acepta un **path de salida como argumento** (`node scripts/build-css.mjs [ruta]`), por defecto `styles.css` en la raíz. Esto es lo que permite la fase de "build en sombra" de §7.2 sin tocar el archivo real.

### 7.2 Fase de "build en sombra" (TICKET-001 a TICKET-006) — corrección de v2

**Problema que corrige:** en v1, ejecutar el build script durante TICKET-001 sobrescribía el `styles.css` real de producción con un archivo casi vacío, porque `styles/` todavía no tenía contenido migrado. Eso rompía la app (y los 3 tests estáticos existentes) en cualquier estado intermedio entre TICKET-001 y TICKET-007, algo inaceptable si cada ticket se mergea por separado.

**Regla para TICKET-001 a TICKET-006:** el build script se ejecuta **solo contra una ruta temporal** (`_build/styles.css.shadow`, fuera del árbol servido), nunca contra `styles.css` en la raíz. El `styles.css` real permanece exactamente como estaba al inicio de la branch durante toda esta fase — la app sigue sirviendo el monolito original sin cambios de comportamiento.

**Consecuencia práctica para 002-006:** "Código que debe eliminarse: los bloques correspondientes del `styles.css` actual" de v1 **se pospone**. Durante 002-006 el contenido se **copia** (no se mueve) a `styles/<archivo>`; el monolito real no se toca todavía. La eliminación real del contenido migrado del monolito ocurre en un único paso, en el ticket de corte.

### 7.3 Ticket de corte (**TICKET-007B — nuevo en v2**)

Una vez que TICKET-007 confirma que el 100% del contenido del `styles.css` original vive en `styles/`, TICKET-007B:
1. Ejecuta `scripts/compare-css.mjs` (nuevo, ver §8) para confirmar que el conjunto `selector → declaraciones` del build en sombra es semánticamente equivalente al `styles.css` original (mismo contenido, reorganizado).
2. Genera `styles.css` en la raíz por primera vez con la ruta de salida real.
3. Este es el único punto de todo el plan donde el `styles.css` de producción cambia de contenido de forma masiva. A partir de aquí, `styles.css` **siempre** es el archivo generado; nunca coexisten monolito y árbol como fuentes de verdad (regla ya declarada en v1 §19.13, ahora aplicada de forma consistente con el resto del plan).
4. Los 3 tests estáticos existentes se ejecutan contra el `styles.css` generado por primera vez aquí, y deben seguir pasando sin modificar sus asserts.

Desde TICKET-008 en adelante, `node scripts/build-css.mjs` (sin argumento de ruta) ya opera de forma segura sobre el archivo real, porque el contenido completo ya vive en `styles/`.

### 7.4 Cambios de infraestructura derivados

- `vercel.json`: se alinea `Cache-Control` de `.css` con la política ya existente para `.js` (Ticket-015).
- `sw.js`: sin cambios — sigue precacheando `/styles.css`.
- `index.html`: sin cambios — el `<link>` sigue apuntando a `styles.css`.

---

## 8. Validación — **rediseñada para un agente sin navegador (punto crítico de v2)**

v1 dependía de capturas de pantalla para casi toda validación de riesgo visual. Eso no es ejecutable en este entorno (sin navegador) ni publicable (el flujo de PR bloquea binarios). v2 reemplaza toda validación visual obligatoria por verificación estructural, y reclasifica lo que de verdad requiere ojos humanos como **posterior y no bloqueante**.

### 8.1 Herramienta nueva: `scripts/compare-css.mjs`

Script Node puro (sin dependencias npm, mismo estilo que los tests existentes) que:
1. Parsea dos hojas de estilo (original vs. generada) en pares `selector → { propiedad: valor }`, ignorando comentarios y espacios en blanco.
2. Reporta selectores presentes en una pero no en la otra, y declaraciones que difieren dentro de un mismo selector.
3. Se usa en TICKET-007B (cutover) y como referencia de auditoría en cualquier ticket de migración pura (002-007) para confirmar "ningún valor cambia" sin depender de lectura visual.
4. **No** reemplaza el juicio del agente en los tickets que sí cambian comportamiento a propósito (008, 010, 011, 012) — en esos, la diferencia de `compare-css.mjs` es *esperada* y se documenta como tal, no como error.

### 8.2 Niveles de validación por ticket

| Nivel | Qué se verifica | Cómo (ejecutable por el agente) |
|---|---|---|
| Estructural | Los 34 archivos existen en la ruta correcta; el build produce un `styles.css` sin errores de sintaxis | `node scripts/build-css.mjs [ruta]` |
| Equivalencia de contenido | Ningún valor cambia en una migración pura | `node scripts/compare-css.mjs <original> <generado>` |
| CSS | Ningún `!important` fuera de los 4 casos permitidos; ningún selector supera 1 clase + 1 pseudo/atributo fuera de `overrides/`; z-index solo vía token | `grep -rn "!important" styles/`; `grep -rn "z-index: [0-9]" styles/` |
| Funcional | Los 3 tests existentes siguen pasando contra el `styles.css` generado | `node tests/player-hud-static-qa.mjs`, `node tests/daily-streak-hub-qa.mjs`, `node tests/shop-catalog-static-qa.mjs` |
| Runtime | Ninguna clase/ID/variable que JS referencia cambió sin actualizar su contraparte | Grep cruzado `js/**` por ticket, listado explícito en cada ticket |
| Accesibilidad | `prefers-reduced-motion` cubre los mismos selectores que antes | Diff de selectores dentro de `overrides/reduced-motion.css` vs. inventario original |
| **Visual (no bloqueante)** | Apariencia real en breakpoints y estados de UI | **Fuera del alcance del agente en este entorno.** Se documenta en el PR como "pendiente de revisión visual humana" para los tickets 008, 010, 011, 012. El agente no debe solicitar esta validación como condición para cerrar el ticket. |

**Regla operativa:** ningún criterio de aceptación de ningún ticket de este documento depende de una captura de pantalla, una comparación visual, o cualquier artefacto binario. Donde v1 pedía eso, v2 pide en su lugar: el resultado de un comando, un grep, o una explicación escrita en el PR de por qué el cambio es seguro.

---

## 9. Estrategia de `!important`

Sin cambios de fondo respecto a v1. Inventario y destino:

| Selector/bloque | Clasificación | Destino |
|---|---|---|
| `.hidden { display: none !important; }` | Legítimo | `utilities/visibility.css`, sin cambios |
| `.visually-hidden { ... !important (×7) }` | Legítimo | `utilities/visibility.css`, sin cambios |
| Reduced-motion (4 reglas, ver detalle en Anexo D) | Necesario | `overrides/reduced-motion.css`, sin cambios |
| `pointer: coarse` (4 reglas sobre `.modal-overlay`, `.identity-modal-overlay`, `.toast`, `.shop-visual-card`) | Síntoma → eliminar | `overrides/touch.css`, sin `!important`, gana por orden de capa |

**Resultado esperado tras la migración:** 4 `!important` totales, frente a 9 hoy.

---

## 10. Plan de migración (tickets)

1. TICKET-000 — Baseline (sin capturas).
2. TICKET-001 — Nueva arquitectura y build script (build en sombra).
3. TICKET-002 — Tokens.
4. TICKET-003 — Base.
5. TICKET-004 — Layout.
6. TICKET-005 — Componentes.
7. TICKET-006 — Features.
8. TICKET-007 — Utilities.
9. **TICKET-007B — Corte: generar `styles.css` real, eliminar monolito (nuevo en v2).**
10. TICKET-008 — Consolidar breakpoint `720px` → `768px`.
11. TICKET-009 — Eliminar overrides `#view-profile .componente`.
12. TICKET-010 — Consolidar `shake`/`shakeX`.
13. TICKET-011 — Eliminar `!important` síntoma; crear `overrides/touch.css`.
14. TICKET-012 — Migrar z-index a tokens.
15. TICKET-013 — Verificar y resolver tokens `--glass-*` legado.
16. TICKET-014 — Tooling: test de guardia de sincronización.
17. TICKET-015 — Alineación de `Cache-Control`.
18. TICKET-016 — Documentación de arquitectura.
19. TICKET-017 — Auditoría final (sin capturas).

**Nota de dependencia:** los tickets 001-007B deben ejecutarse en ese orden estricto y ninguno de ellos, salvo 007B, toca el `styles.css` real. A partir de 007B, cada ticket posterior sí opera sobre el archivo real y puede ejecutarse de forma independiente respetando sus propias dependencias declaradas.

---

## 11. Tooling

| Herramienta | Estado hoy | Decisión |
|---|---|---|
| Script de build CSS propio | No existe | Incorporar (TICKET-001) |
| Script de comparación semántica (`compare-css.mjs`) | No existe | Incorporar (TICKET-001, usado en 007B) |
| `package.json` mínimo | No existe | Incorporar, sin dependencias |
| Stylelint | No existe | No incorporar en esta migración — recomendación explícita para ticket futuro fuera de este plan |
| Runner de regresión visual (headless browser) | No existe | No incorporar — fuera del alcance de este entorno de ejecución y del tamaño del proyecto |
| Test de guardia de sincronización | No existe | Incorporar (TICKET-014) |

---

## 12. Tickets de implementación

Cada ticket es ejecutable sin decisiones arquitectónicas adicionales por parte del agente, salvo donde se indica explícitamente "decisión delegada".

---

# TICKET-000: Baseline

## Objetivo
Capturar el estado actual como referencia de no-regresión antes de tocar nada.

## Problema que resuelve
Sin baseline, no hay forma objetiva de confirmar equivalencia funcional tras la migración.

## Archivos afectados
Ninguno se modifica; se generan artefactos en `_baseline/` (fuera del árbol de producción).

## Cambios exactos
1. Copiar `styles.css` actual (el de esta branch, no `main`) a `_baseline/styles.css.before`.
2. Ejecutar y guardar la salida de los 3 tests de CSS existentes.

## Reglas que deben cumplirse
Ninguna modificación de `styles.css` en este ticket. **No se generan capturas de pantalla** — no son viables en este entorno; la validación visual queda fuera del alcance del agente (ver §8.2).

## Implementación paso a paso
1. `cp styles.css _baseline/styles.css.before`
2. `node tests/player-hud-static-qa.mjs > _baseline/player-hud.log`
3. `node tests/daily-streak-hub-qa.mjs > _baseline/daily-streak.log`
4. `node tests/shop-catalog-static-qa.mjs > _baseline/shop-catalog.log`

## Código que debe eliminarse
Ninguno.

## Dependencias
Ninguna.

## Fuera de alcance
Cualquier cambio de código. Cualquier captura de pantalla o comparación visual.

## Criterios de aceptación
- [ ] `_baseline/styles.css.before` idéntico byte a byte al `styles.css` al inicio de esta branch.
- [ ] Los 3 logs muestran "passed".

## Validación
`diff styles.css _baseline/styles.css.before` (debe devolver vacío).

## Riesgos
Ninguno.

## Rollback
Eliminar `_baseline/`.

## Resultado esperado
Punto de referencia auditable, 100% verificable por comando.

---

# TICKET-001: Nueva arquitectura de directorios y scripts de ensamblado

## Objetivo
Crear el árbol `styles/` completo (34 archivos), `scripts/build-css.mjs` y `scripts/compare-css.mjs`, sin migrar contenido todavía y **sin tocar el `styles.css` real**.

## Problema que resuelve
Filas 1, 2, 20, 21 de §4.

## Archivos afectados
Nuevos: los 34 archivos de §5.1, `scripts/build-css.mjs`, `scripts/compare-css.mjs`, `package.json`.

## Cambios exactos
1. Crear cada archivo de §5.1 con solo un comentario de cabecera: `/* <ruta relativa> — <responsabilidad> */`.
2. Crear `scripts/build-css.mjs` con la lógica de §7.1, aceptando un path de salida opcional como argumento (default `styles.css`).
3. Crear `scripts/compare-css.mjs` con la lógica de §8.1.
4. Crear `package.json` con `{ "name": "love-arcade", "private": true, "scripts": { "build:css": "node scripts/build-css.mjs", "build:css:shadow": "node scripts/build-css.mjs _build/styles.css.shadow" } }`, sin dependencias.

## Reglas que deben cumplirse
Cero dependencias npm. **El `styles.css` real de la raíz no se ejecuta como destino del build en este ticket ni en los siguientes hasta TICKET-007B** — solo se valida contra `_build/styles.css.shadow`.

## Implementación paso a paso
1. Crear los 34 archivos vacíos (solo cabecera).
2. Implementar ambos scripts.
3. Ejecutar `node scripts/build-css.mjs _build/styles.css.shadow`: debe producir un archivo válido (solo comentarios + líneas `@layer`), **nunca** contra `styles.css` de la raíz.
4. Crear `package.json`.

## Código que debe eliminarse
Ninguno todavía.

## Código que debe conservarse
El `styles.css` real, completamente sin tocar.

## Dependencias
TICKET-000.

## Fuera de alcance
Migrar contenido real (TICKET-002 a TICKET-007). Escribir el `styles.css` real (TICKET-007B).

## Criterios de aceptación
- [ ] Los 34 archivos existen en las rutas de §5.1.
- [ ] `node scripts/build-css.mjs _build/styles.css.shadow` corre sin error.
- [ ] `node scripts/compare-css.mjs` existe y corre sin error sobre dos archivos de prueba.
- [ ] `package.json` sin dependencias.
- [ ] `diff styles.css _baseline/styles.css.before` sigue vacío (el archivo real no cambió).

## Validación
`node scripts/build-css.mjs _build/styles.css.shadow && head -5 _build/styles.css.shadow`; `diff styles.css _baseline/styles.css.before`.

## Riesgos
Bajo.

## Rollback
Eliminar `styles/`, `scripts/`, `package.json`, `_build/`.

## Resultado esperado
Esqueleto de arquitectura y ensamblado funcionando end-to-end en modo sombra, sin ningún riesgo para el archivo servido.

---

# TICKET-002: Migración de tokens (a `styles/`, en modo sombra)

## Objetivo
Copiar el bloque `:root` completo a `tokens/01-colors.css` … `06-z-index.css`, tokenizando duraciones repetidas y añadiendo la escala de z-index.

## Problema que resuelve
Filas 5, 8 de §4.

## Archivos afectados
Los 6 archivos de `tokens/`.

## Cambios exactos
1. `01-colors.css`: superficie, texto AA, accent/tema, semánticas, alias `--glass-*` (se copian tal cual; su eliminación es TICKET-013, que ocurre después de TICKET-007B).
2. `02-typography.css`: `@font-face` (×3) y `--font-*`.
3. `03-spacing-layout.css`: `--radius-*`, `--nav-height`, `--pill-nav-*`.
4. `04-motion.css`: `--motion-*` existentes + `--ease-snap` nuevo (curva repetida ≥2 veces, confirmar por grep).
5. `05-shadow.css`: `--shadow-*`, `--surface-shadow-*`, `--control-shadow-*`.
6. `06-z-index.css` (nuevo): las 5 variables de §5.2.

## Reglas que deben cumplirse
Ningún valor cambia; solo se tokeniza lo que ya se repite ≥2 veces textualmente. **Se copia, no se mueve** — el `:root` del `styles.css` real permanece intacto hasta TICKET-007B.

## Implementación paso a paso
1. Copiar (no eliminar del original) el contenido de `:root` a los 5 archivos según naturaleza.
2. Buscar duraciones/curvas repetidas ≥2 veces y añadir token si aplica.
3. Añadir `06-z-index.css`.
4. `node scripts/build-css.mjs _build/styles.css.shadow`; `node scripts/compare-css.mjs styles.css _build/styles.css.shadow` para confirmar que el `:root` migrado es equivalente (se esperan diferencias en el resto del archivo, todavía no migrado — documentar eso en el PR, no es un error).

## Código que debe eliminarse
Ninguno del `styles.css` real (se pospone a TICKET-007B).

## Dependencias
TICKET-001.

## Fuera de alcance
Eliminar `--glass-*`; migrar z-index de los selectores consumidores (TICKET-012); tocar el `styles.css` real.

## Criterios de aceptación
- [ ] Cada custom property original existe en exactamente uno de los 5 archivos de `styles/tokens/`.
- [ ] `06-z-index.css` define las 5 variables con los valores literales actuales.
- [ ] El conjunto de nombres de variable en `styles/tokens/` coincide con el `:root` original.
- [ ] `styles.css` real sin diff.

## Validación
`node scripts/build-css.mjs _build/styles.css.shadow`; `node scripts/compare-css.mjs` sobre el bloque `:root`; `diff styles.css _baseline/styles.css.before`.

## Riesgos
Bajo.

## Rollback
Revertir el commit.

## Resultado esperado
Tokens centralizados en `styles/`, `styles.css` real sin cambios todavía.

---

# TICKET-003: Migración de base (modo sombra)

## Objetivo
Copiar reset, `html`/`body`, sprite `.icon` a `base/`.

## Archivos afectados
`base/01-reset.css`, `02-document.css`, `03-icons.css`.

## Cambios exactos
1. `01-reset.css`: `*,*::before,*::after`, `a`, `ul`, `button`.
2. `02-document.css`: `html`, `body` (incl. `body::before` scanline y su `@media (pointer: coarse)` co-locado).
3. `03-icons.css`: `.icon`, `.icon:not([width])`, combinadores de icono inline.

## Reglas que deben cumplirse
Ningún valor cambia; se copia, no se mueve del `styles.css` real.

## Dependencias
TICKET-002.

## Criterios de aceptación
- [ ] Los 3 archivos contienen exactamente las reglas listadas.
- [ ] `styles.css` real sin diff.

## Validación
`node scripts/build-css.mjs _build/styles.css.shadow`; `diff styles.css _baseline/styles.css.before`.

## Riesgos
Bajo.

## Rollback
Revertir el commit.

## Resultado esperado
Capa `base` completa en modo sombra.

---

# TICKET-004: Migración de layout (modo sombra)

## Objetivo
Copiar `.container`, navbar, pill-nav, transiciones de vista SPA a `layout/`.

## Archivos afectados
`layout/container.css`, `navbar.css`, `pill-nav.css`, `view-transitions.css`.

## Cambios exactos
1. `container.css`: `.container`, `.section-*`.
2. `navbar.css`: `.navbar`, `.nav-brand*`, `.nav-user` + media queries co-locadas.
3. `pill-nav.css`: `.pill-nav*` + su `@media (prefers-reduced-motion)` local + media queries de ancho.
4. `view-transitions.css`: `.view-section*`, `#view-shop { overscroll-behavior-y; touch-action; }`.

## Reglas que deben cumplirse
Ningún valor cambia; z-index se queda como literal `1000` en este ticket (TICKET-012 lo migra a token, después de TICKET-007B). Se copia, no se mueve.

## Dependencias
TICKET-003.

## Criterios de aceptación
- [ ] Los 4 archivos contienen exactamente las reglas listadas.
- [ ] `#view-shop` vive en `view-transitions.css`.
- [ ] El `!important` de `pill-nav.css` (reduced-motion local) es exactamente 1.
- [ ] `styles.css` real sin diff.

## Validación
`node scripts/build-css.mjs _build/styles.css.shadow`; `grep -c "!important" styles/layout/pill-nav.css`.

## Riesgos
Bajo.

## Rollback
Revertir el commit.

## Resultado esperado
Capa `layout` completa en modo sombra.

---

# TICKET-005: Migración de componentes (modo sombra)

## Objetivo
Copiar los 12 archivos de `components/`.

## Archivos afectados
Los 12 archivos de `components/` listados en §5.1.

## Cambios exactos
Mapeo idéntico a v1 (buttons, interactive-states, glass-panel, modal-base, toast, feedback-msg, theme-picker, coin-badge, avatar, history-list, economy-info, shake — este último se elimina en TICKET-010, después de TICKET-007B; aquí se copia tal cual).

## Reglas que deben cumplirse
Ningún selector de `components/` referencia un ID de vista. Se copia, no se mueve.

## Implementación paso a paso
1. Migrar archivo por archivo, verificando cruzado contra `js/shop-logic.js`, `js/ui/micro-interactions.js`, `js/streak-hub.js`, `js/ui/coin-display.js` que ninguna clase quede huérfana.
2. Confirmar que `.eco-badge--moon/--gold` se copian también a `features/profile/moon-blessing.css` (no son de `components/`, según §5.1).

## Dependencias
TICKET-004.

## Fuera de alcance
Consolidar `shake`/`shakeX` (TICKET-010). Tocar el `styles.css` real.

## Criterios de aceptación
- [ ] Los 12 archivos contienen las reglas listadas.
- [ ] Ningún selector de `components/` referencia `#view-*`.
- [ ] Verificación cruzada sin clases huérfanas.
- [ ] `styles.css` real sin diff.

## Validación
`node scripts/build-css.mjs _build/styles.css.shadow`; grep cruzado JS↔CSS.

## Riesgos
Medio — mayor volumen tocado; dividir en sub-commits por archivo si el diff es grande.

## Rollback
Revertir el commit o sub-commits.

## Resultado esperado
Capa `components` completa en modo sombra.

---

# TICKET-006: Migración de features (modo sombra)

## Objetivo
Copiar los 14 archivos de `features/`.

## Archivos afectados
Los 14 archivos bajo `features/` listados en §5.1.

## Cambios exactos
Mapeo idéntico a v1 (home, games, shop, profile, onboarding — ver detalle completo en Anexo E). Dos archivos requieren **cabecera obligatoria** documentando el contrato JS↔CSS:
- `features/home/daily-streak-hub.css`: documentar `--coin-x`, `--coin-y`, `--spark-drift`, `--flame-glow-*` como API escrita por `js/streak-hub.js`.
- `features/shop/shop-grid.css`: documentar `data-aspect-ratio` como contrato de `js/shop-logic.js`.

## Reglas que deben cumplirse
Toda variable CSS escrita desde JS debe documentarse. Se copia, no se mueve.

## Implementación paso a paso
1. Migrar archivo por archivo según el mapeo del Anexo E.
2. Añadir comentarios de contrato en los 2 archivos indicados.
3. Verificación cruzada contra `js/spa-router.js`, `js/shop-logic.js`, `js/streak-hub.js`, `js/ui/hud-render.js`, `js/cloud/sentinel.js`.

## Dependencias
TICKET-005.

## Fuera de alcance
Eliminar overrides `#view-profile` (TICKET-009, después de TICKET-007B). Tocar el `styles.css` real.

## Criterios de aceptación
- [ ] Los 14 archivos contienen las reglas listadas.
- [ ] `daily-streak-hub.css` y `shop-grid.css` tienen el comentario de contrato.
- [ ] Verificación cruzada sin clases huérfanas.
- [ ] `styles.css` real sin diff.

## Validación
`node scripts/build-css.mjs _build/styles.css.shadow`; grep cruzado JS↔CSS.

## Riesgos
Medio-Alto — mayor volumen del plan; dividir en sub-commits por subsistema.

## Rollback
Revertir el commit o sub-commits.

## Resultado esperado
Capa `features` completa en modo sombra.

---

# TICKET-007: Migración de utilities (modo sombra)

## Objetivo
Copiar `.hidden`/`.visually-hidden` a `utilities/visibility.css`.

## Archivos afectados
`utilities/visibility.css`.

## Cambios exactos
Copiar ambos bloques tal cual, con sus `!important` intactos.

## Dependencias
TICKET-006.

## Criterios de aceptación
- [ ] `utilities/visibility.css` contiene ambas reglas con `!important` intacto (8 apariciones: 1 de `.hidden` + 7 de `.visually-hidden`).
- [ ] `styles.css` real sin diff.

## Validación
`grep -c "!important" styles/utilities/visibility.css` → 8.

## Riesgos
Nulo.

## Rollback
Revertir el commit.

## Resultado esperado
Capa `utilities` completa en modo sombra. **Con este ticket, el 100% del contenido del `styles.css` original ya vive copiado en `styles/`.**

---

# TICKET-007B: Corte — generar `styles.css` real y eliminar el monolito

## Objetivo
Ejecutar el swap único: el `styles.css` real pasa a ser el archivo generado por `scripts/build-css.mjs`, y el contenido legado hand-editado se elimina, porque monolito y árbol nunca coexisten como fuente de verdad.

## Problema que resuelve
Cierra la migración de organización (filas 1, 2, 20, 21 de §4) de forma segura, sin el riesgo de estados intermedios rotos que tenía v1.

## Archivos afectados
`styles.css` (se regenera por completo), `styles/**` (sin cambios de contenido, solo deja de estar en modo sombra).

## Cambios exactos
1. Ejecutar `node scripts/compare-css.mjs styles.css _build/styles.css.shadow` (comparando el monolito original contra el build en sombra) y confirmar equivalencia total de selectores y declaraciones. Cualquier diferencia encontrada aquí es un defecto de una migración anterior (002-007) y debe corregirse antes de continuar — no se avanza con diferencias sin explicar.
2. Ejecutar `node scripts/build-css.mjs` (sin argumento — ahora sí, ruta real) para generar el `styles.css` definitivo.
3. Confirmar que los 3 tests estáticos existentes pasan contra el `styles.css` recién generado.
4. Eliminar `_build/` (ya no se necesita el modo sombra).

## Reglas que deben cumplirse
Este es el único ticket de todo el plan donde el `styles.css` real cambia de contenido de forma masiva. Ningún ticket anterior ni posterior debe volver a hacer esto — de aquí en adelante, editar siempre en `styles/` y regenerar.

## Código que debe eliminarse
Todo el contenido hand-editado del `styles.css` original (reemplazado por el generado; ya no queda ningún resto del monolito, porque su contenido íntegro vive ahora en `styles/`).

## Dependencias
TICKET-001 a TICKET-007.

## Fuera de alcance
Cualquier cambio de comportamiento (breakpoints, `!important`, z-index, overrides de vista, animaciones) — eso es TICKET-008 a TICKET-012, todos posteriores a este corte.

## Criterios de aceptación
- [ ] `node scripts/compare-css.mjs styles.css _build/styles.css.shadow` (ejecutado ANTES del swap, contra el `styles.css` previo al corte) no reporta diferencias no explicadas.
- [ ] `styles.css` generado tiene `@layer tokens, base, layout, components, features, utilities, overrides;` como primera línea funcional.
- [ ] Los 3 tests estáticos existentes pasan contra el `styles.css` generado.
- [ ] `_build/` eliminado.

## Validación
Los 2 comandos anteriores + los 3 tests.

## Riesgos
Medio — es el único punto de "todo o nada" del plan de organización. Mitigado por ejecutarse solo después de que 001-007 ya validaron cada capa por separado en modo sombra.

## Rollback
`cp _baseline/styles.css.before styles.css` (restaura el monolito original byte a byte).

## Documentación
TICKET-016 documenta este flujo como "editar en `styles/` → `npm run build:css` → correr tests", vigente desde aquí en adelante.

## Resultado esperado
`styles.css` es ahora, y para siempre, un artefacto generado. La reorganización estructural (filas 1, 2, 20, 21 de §4) queda resuelta sin haber roto el sitio en ningún punto intermedio.

---

# TICKET-008: Consolidar breakpoint `720px` → `768px`

## Objetivo
Eliminar la inconsistencia de breakpoint (fila 9, §4).

## Archivos afectados
`features/profile/profile-hub.css`, `features/profile/profile-screens.css`.

## Cambios exactos
Cambiar `@media (min-width: 720px)` por `768px` en los 3 selectores identificados (`.profile-action-grid`, `.theme-grid` en contexto de Perfil, `.profile-coming-soon-grid`).

## Reglas que deben cumplirse
Cambio potencialmente visual, acotado al rango 720–767px. **No hay navegador disponible para verificación visual en este entorno.** El agente debe, en su lugar: (a) leer el CSS de grid/layout de los 3 selectores afectados y describir en el PR qué cambia exactamente para un viewport de, p. ej., 740px (pasa de layout "ancho ≥720" a "ancho <768", es decir de la variante desktop a la variante mobile del componente, en ese rango de 48px), y (b) marcar explícitamente el ticket con la nota "pendiente de revisión visual humana en el rango 720–767px" — sin que esto bloquee el cierre del ticket por parte del agente.

## Implementación paso a paso
1. Localizar los 3 usos en `styles/`.
2. Cambiar el valor.
3. Documentar en el PR el efecto esperado en el rango 720–767px (paso a paso, no solo "no debería cambiar nada").

## Dependencias
TICKET-007B.

## Fuera de alcance
Los demás breakpoints (379/640/1024, ya consistentes). Validación visual real (queda para revisión humana posterior).

## Criterios de aceptación
- [ ] Los 3 usos de `720px` ya no existen en `styles/`.
- [ ] El PR documenta el efecto esperado en el rango 720–767px.
- [ ] Nota "pendiente de revisión visual humana" incluida en el PR.

## Validación
`grep -rn "720px" styles/` → vacío.

## Riesgos
Medio — único cambio del plan con riesgo visual real, acotado a 48px de viewport, sin verificación automática posible en este entorno; mitigado con revisión humana posterior no bloqueante.

## Rollback
Revertir el valor.

## Resultado esperado
Un solo breakpoint de tablet/desktop en todo el sistema.

---

# TICKET-009: Eliminar overrides `#view-profile .componente`, introducir modificadores de clase

## Objetivo
Reemplazar los selectores `#view-profile .clase-compartida` por modificadores de clase explícitos o fusión directa cuando el nodo es único.

## Problema que resuelve
Fila 4 de §4.

## ⚠️ Hipótesis a confirmar antes de implementar (no asumir el número de v1)
v1 afirmaba "8 selectores" pero solo documentaba evidencia nombrada para 4: `.theme-grid`, `.memory-card`, `.history-list`, `.theme-btn`. **Antes de tocar cualquier archivo**, el agente debe ejecutar `grep -rn "#view-profile \." styles.css` (sobre el `styles.css` real ya generado por TICKET-007B) y usar el resultado real como fuente de verdad — no el número "8" ni la lista de 4 de este documento. Si el grep encuentra selectores no listados aquí (p. ej. relacionados con `feedback-msg`), se tratan igual que los demás (fusión o modificador, según corresponda), documentando en el PR el inventario completo real encontrado.

## Archivos afectados
`index.html`, y los archivos de `styles/` que el grep anterior determine (probablemente incluye `features/profile/profile-screens.css`, `components/theme-picker.css`, `features/profile/sync-cards.css`, `components/history-list.css`; confirmar si `components/feedback-msg.css` aplica según el grep).

## Cambios exactos
Para cada `#view-profile .clase { declaraciones }` confirmado por grep:
1. Releer `index.html` para confirmar si el nodo afectado es un ID único (fusión directa posible) o una clase reutilizada fuera de Perfil (modificador `--profile` necesario). **Decisión delegada al agente**, con este criterio ya fijado — no requiere preguntar.
2. Caso ID único: fusionar la regla en el componente base, eliminar el prefijo `#view-profile`.
3. Caso clase reutilizada: crear `.clase--profile`, aplicar la clase en `index.html`.
4. Eliminar el selector `#view-profile .clase` original.

## Reglas que deben cumplirse
El cuerpo de cada declaración no cambia, solo el selector y el punto de aplicación en HTML.

## Código que debe conservarse
`#view-profile { max-width: 760px; margin-inline: auto; }` (layout puro del contenedor, legítimo, no es un override de componente).

## Dependencias
TICKET-007B.

## Fuera de alcance
Cualquier cambio visual — el resultado debe ser idéntico al actual.

## Criterios de aceptación
- [ ] El PR incluye la salida completa del grep de auditoría inicial (inventario real, no el de v1).
- [ ] Ningún selector `#view-profile .clase-compartida` permanece, salvo la excepción de layout puro documentada.
- [ ] Cada nodo tocado en `index.html` recibe la clase correcta o queda fusionado sin necesitarla.
- [ ] Nota "pendiente de revisión visual humana de las pantallas de Perfil" incluida en el PR (no bloqueante).

## Validación
`grep -rn "#view-profile \." styles/` → vacío salvo la excepción.

## Riesgos
Medio — toca `index.html` compartido; ejecutar por sub-commit, un componente a la vez.

## Rollback
Revertir el commit combinado de `styles/` + `index.html` por sub-commit.

## Resultado esperado
Cero acoplamiento entre el estilo final de un componente compartido y la vista donde está montado.

---

# TICKET-010: Consolidar `shake`/`shakeX`

## Objetivo
Eliminar la duplicación conceptual (fila 19, §4).

## Archivos afectados
`components/shake.css` (se elimina), `components/feedback-msg.css` (conserva `shakeX` renombrada a `shake`).

## Cambios exactos
1. Grep de `.anim-shake` en `js/` (esperado: `js/shop-logic.js`, función `shakeElement()`, aplicada sobre `#btn-redeem` — confirmar con grep, no asumir).
2. Redefinir `.anim-shake { animation: shake 0.24s cubic-bezier(.36,.07,.19,.97); }` (parámetros de la antigua `shakeX`).
3. Eliminar `components/shake.css` y la `@keyframes shake` de 0.45s original.
4. Renombrar `@keyframes shakeX` a `@keyframes shake`, actualizar `.is-shaking`/`.toast--error`.

## Reglas que deben cumplirse
El resultado debe seguir comunicando "error/feedback negativo"; se acepta el cambio de duración/curva como consolidación deliberada.

## Dependencias
TICKET-007B.

## Criterios de aceptación
- [ ] `components/shake.css` ya no existe.
- [ ] Una única `@keyframes shake` en todo `styles/`.
- [ ] Grep confirma que `.anim-shake` solo se usa en el flujo de código promocional.
- [ ] Nota "pendiente de revisión visual humana del shake" incluida en el PR (no bloqueante).

## Validación
`grep -rn "@keyframes shake" styles/` → exactamente 1 resultado.

## Riesgos
Bajo — cambio de timing menor en animación secundaria, sin verificación visual automática posible.

## Rollback
Restaurar `components/shake.css` y el nombre `shakeX`.

## Resultado esperado
Una sola implementación de "sacudida de error" en todo el sistema.

---

# TICKET-011: Eliminar `!important` síntoma; crear `overrides/touch.css`

## Objetivo
Ejecutar la eliminación de §9 para los 4 casos "síntoma".

## Archivos afectados
`overrides/touch.css` (nuevo); `components/modal-base.css`, `features/onboarding/identity-modal.css`, `components/toast.css`, `features/shop/shop-grid.css` (se elimina el bloque `pointer: coarse` de cada uno).

## Cambios exactos
1. Crear `overrides/touch.css` con las 4 reglas sin `!important`.
2. Eliminar el bloque original disperso de los 4 archivos de origen.

## Reglas que deben cumplirse
El orden de capa (`overrides` es la última) garantiza la prioridad sin `!important`.

## Dependencias
TICKET-007B.

## Fuera de alcance
El `@media (pointer: coarse)` de `body::before` (ya resuelto co-locado en TICKET-003).

## Criterios de aceptación
- [ ] `overrides/touch.css` existe con las 4 reglas, sin `!important`.
- [ ] El bloque original ya no existe en los 4 archivos de origen.
- [ ] Los 3 tests de CSS existentes siguen pasando.
- [ ] Nota "pendiente de revisión visual humana en emulación `pointer: coarse`" incluida en el PR (no bloqueante).

## Validación
`grep -rn "!important" styles/overrides/touch.css` → vacío; los 3 tests de CSS existentes.

## Riesgos
Bajo — el orden de capas garantiza prioridad sin fuerza; sin verificación visual automática posible.

## Rollback
Restaurar el bloque `!important` disperso original.

## Resultado esperado
Cero `!important` síntoma; 4 `!important` totales en el sistema.

---

# TICKET-012: Migrar z-index a tokens

## Objetivo
Reemplazar los 5 literales de z-index por `var(--z-*)`.

## Archivos afectados
`layout/navbar.css`, `layout/pill-nav.css`, `components/toast.css`, `components/modal-base.css`, `features/onboarding/identity-modal.css`.

## Cambios exactos
Sustitución 1:1: `1000` → `var(--z-sticky-nav)`, `9999` → `var(--z-toast)`, `10000` → `var(--z-modal)`, `10500` → `var(--z-modal-priority)`.

## Reglas que deben cumplirse
Ningún valor computado cambia — es una sustitución textual pura, verificable sin necesidad de navegador.

## Dependencias
TICKET-007B.

## Criterios de aceptación
- [ ] `grep -rn "z-index: [0-9]" styles/` → vacío.
- [ ] `node scripts/compare-css.mjs` confirma que el valor resuelto de cada `z-index` es idéntico al anterior (comparar el valor de la variable, no solo su nombre).

## Validación
El grep anterior + `compare-css.mjs`.

## Riesgos
Bajo — a diferencia de 008/010/011, este cambio sí es 100% verificable sin navegador (sustitución de literal por variable con el mismo valor resuelto), por lo que no requiere nota de revisión visual pendiente.

## Rollback
Revertir el commit.

## Resultado esperado
Escala de z-index nombrada y consumida en todo el sistema.

---

# TICKET-013: Verificar y resolver tokens `--glass-*` legado

## Objetivo
Confirmar con evidencia si los 9 alias `--glass-*` siguen en uso, y actuar en consecuencia.

## Archivos afectados
`tokens/01-colors.css`; potencialmente `features/profile/sync-cards.css`, `features/profile/promo-code-form.css`.

## Cambios exactos
1. Ejecutar `grep -rn "glass-base\|glass-float\|glass-hi" .` sobre el repositorio completo.
2. **Hipótesis a reconfirmar (no asumida como definitiva):** `--glass-float-border` y `--glass-base-border` estarían en uso activo en `.memory-card` y `.sync-separator`. Las 7 variables restantes requieren confirmación real por el agente en el momento de ejecutar este ticket.
3. Actualizar el comentario en `tokens/01-colors.css`: quitar "Legacy" de las confirmadas en uso; eliminar las confirmadas sin uso.

## Reglas que deben cumplirse
No se elimina ningún token sin el grep documentado en el PR.

## Dependencias
TICKET-007B.

## Fuera de alcance
Los tokens `--solid-surface-*` (confirmados en uso extenso, no se tocan).

## Criterios de aceptación
- [ ] Salida completa del grep adjunta al PR (como texto, no captura).
- [ ] Cada una de las 9 variables tiene decisión documentada con evidencia de grep.
- [ ] El comentario "Legacy" se actualiza o elimina según el resultado real.

## Validación
El grep mencionado; `node scripts/build-css.mjs` tras cualquier eliminación.

## Riesgos
Bajo-Medio — un `getPropertyValue`/`setProperty` con nombre construido dinámicamente (template string) no aparecería en grep textual; el agente debe revisar manualmente cualquier uso de `setProperty`/`getPropertyValue` con template strings en `js/` antes de eliminar una variable.

## Rollback
Restaurar las variables eliminadas.

## Resultado esperado
Cero ambigüedad sobre qué tokens de superficie son reales.

---

# TICKET-014: Tooling — test de guardia de sincronización

## Objetivo
Garantizar que `styles.css` generado nunca queda desincronizado de `styles/`.

## Archivos afectados
Nuevo: `tests/css-build-sync.test.mjs`. Sin cambios en los 3 tests existentes.

## Cambios exactos
1. Crear `tests/css-build-sync.test.mjs`: ejecuta `scripts/build-css.mjs` a un buffer/archivo temporal, compara (con `scripts/compare-css.mjs` o comparación textual directa) contra el `styles.css` versionado, falla si difieren.
2. Confirmar que los 3 tests existentes siguen pasando.

## Reglas que deben cumplirse
Sin dependencias npm nuevas; mismo estilo que los tests existentes (`node:assert/strict`).

## Dependencias
TICKET-007B a TICKET-013 completos.

## Fuera de alcance
Introducir Stylelint (decisión explícita: no en esta migración).

## Criterios de aceptación
- [ ] El test de guardia pasa cuando `styles.css` está sincronizado, y falla si se edita a mano sin correr el build (verificar el caso negativo con una edición de prueba temporal, luego revertida).
- [ ] Los 3 tests existentes pasan sin modificación de sus asserts.

## Validación
Los 4 comandos de test.

## Riesgos
Bajo.

## Rollback
Eliminar el archivo de test nuevo.

## Resultado esperado
Imposible mergear un `styles.css` desincronizado sin que un test lo detecte.

---

# TICKET-015: Alineación de `Cache-Control`

## Objetivo
Alinear la política de caché HTTP de `.css` con la de `.js` en `vercel.json`.

## Problema que resuelve
Fila 16 de §4.

## Archivos afectados
`vercel.json`.

## Cambios exactos
Añadir al bloque de `/(.*)\.css` la misma política que ya tiene `/(.*)\.(js|mjs)` (confirmar el valor exacto leyendo `vercel.json`, no asumirlo).

## Dependencias
TICKET-007B.

## Criterios de aceptación
- [ ] `vercel.json` aplica la misma política de `.css` que de `.js`.
- [ ] `sw.js` sin diff.

## Validación
Inspección manual del diff de `vercel.json`.

## Riesgos
Bajo.

## Rollback
Revertir `vercel.json`.

## Resultado esperado
Política de caché consistente en todo el app shell.

---

# TICKET-016: Documentación de arquitectura

## Objetivo
Producir `docs/CSS_ARCHITECTURE.md`.

## Archivos afectados
Nuevo `docs/CSS_ARCHITECTURE.md`; actualizar `README.md`.

## Cambios exactos
El documento incluye: Estructura, Dependencias, Cascada, Tokens, Componentes, Variantes, Estados, Responsive, Overrides, Excepciones, y "Cómo modificar este CSS con seguridad" (criterio de 7 preguntas de §5.1, flujo de build de §7, uso de `compare-css.mjs`).

## Dependencias
Todos los tickets anteriores.

## Criterios de aceptación
- [ ] `docs/CSS_ARCHITECTURE.md` con las 11 secciones exigidas.
- [ ] `node tests/documentation-static-qa.mjs` pasa.
- [ ] `README.md` enlaza el documento nuevo.

## Validación
`node tests/documentation-static-qa.mjs`.

## Riesgos
Ninguno.

## Rollback
Eliminar el archivo y su referencia.

## Resultado esperado
Cualquier dev o agente entiende la arquitectura sin leer el historial completo.

---

# TICKET-017: Auditoría final

## Objetivo
Confirmar con evidencia ejecutada que la migración cumple el criterio de éxito del encargo.

## Archivos afectados
Ninguno (solo lectura/ejecución).

## Implementación paso a paso
1. Ejecutar los 4 tests de CSS + `documentation-static-qa`.
2. `grep -rn "!important" styles/` → confirmar exactamente 4.
3. `grep -rn "z-index: [0-9]" styles/` → vacío.
4. `grep -rn "#view-profile \." styles/` → vacío salvo excepción documentada.
5. `grep -rn "720px" styles/` → vacío.
6. Confirmar que `index.html`/`sw.js` no tienen cambios no documentados.
7. Compilar la lista de notas "pendiente de revisión visual humana" dejadas por TICKET-008, 009, 010, 011 en un único resumen al final del informe de cierre, para que un humano las revise cuando pueda — **sin que esto bloquee el cierre del ticket**.

## Dependencias
Todos los tickets 000-016.

## Fuera de alcance
Cualquier hallazgo nuevo se convierte en un ticket adicional, no se resuelve ad hoc aquí. Ejecutar la revisión visual humana (queda pendiente, fuera del alcance del agente).

## Criterios de aceptación
- [ ] Los 5 comandos de grep devuelven exactamente lo esperado.
- [ ] Los 5 tests pasan.
- [ ] `index.html`/`sw.js` sin cambios no documentados.
- [ ] Resumen de pendientes de revisión visual humana incluido en el informe de cierre.
- [ ] Checklist de §13 completado.

## Validación
Los 5 comandos + 5 tests.

## Riesgos
Ninguno.

## Rollback
N/A.

## Resultado esperado
Confirmación objetiva y 100% automatizable de que la arquitectura objetivo está implementada, con un resumen claro y acotado de lo que queda pendiente de ojo humano (no de trabajo del agente).

---

## 13. Checklist de auditoría final

- [ ] Los 34 archivos de `styles/` existen exactamente en las rutas de §5.1.
- [ ] `scripts/build-css.mjs` genera `styles.css` de forma determinista, sin dependencias npm.
- [ ] `scripts/compare-css.mjs` existe y se usó en TICKET-007B sin diferencias no explicadas.
- [ ] `@layer tokens, base, layout, components, features, utilities, overrides;` es la primera línea funcional del `styles.css` generado.
- [ ] `grep -rn "!important" styles/` devuelve exactamente 4 resultados, todos en `utilities/visibility.css` u `overrides/reduced-motion.css`.
- [ ] `grep -rn "z-index: [0-9]" styles/` devuelve vacío.
- [ ] `grep -rn "#view-profile \." styles/` devuelve vacío salvo la excepción documentada de layout puro.
- [ ] `grep -rn "720px" styles/` devuelve vacío.
- [ ] `grep -rn "@keyframes shake" styles/` devuelve exactamente 1 resultado.
- [ ] Los 9 tokens `--glass-*` tienen decisión documentada (conservar/eliminar) respaldada por grep real.
- [ ] `node tests/css-build-sync.test.mjs`, `node tests/player-hud-static-qa.mjs`, `node tests/daily-streak-hub-qa.mjs`, `node tests/shop-catalog-static-qa.mjs`, `node tests/documentation-static-qa.mjs` pasan todos.
- [ ] `index.html` conserva `<link rel="stylesheet" href="styles.css">` sin cambios de ruta.
- [ ] `sw.js` sin diff.
- [ ] `vercel.json` aplica la misma política de `Cache-Control` a `.css` que a `.js`.
- [ ] `docs/CSS_ARCHITECTURE.md` existe, cubre las 11 secciones exigidas, y está enlazado desde `README.md`.
- [ ] Ningún ID nuevo introducido en `styles/` sin un `getElementById` correspondiente verificado en `js/`.
- [ ] Ningún token nuevo creado para un valor de un solo uso sin rol semántico.
- [ ] **Ningún criterio de este checklist depende de una captura de pantalla o comparación visual.**
- [ ] Resumen de pendientes de revisión visual humana (TICKET-008, 009, 010, 011) documentado y entregado, sin haber bloqueado ningún cierre de ticket.

---

## Anexos

Los Anexos A-E (detalle exhaustivo de archivos inspeccionados, evidencia fila por fila de §4, responsabilidades por directorio, criterio de 7 preguntas, y mapeo completo de selectores en TICKET-006) son idénticos en contenido a las secciones correspondientes de v1 y no se repiten aquí para mantener este documento enfocado en lo que cambió. Si el agente los necesita para un ticket específico, debe consultar la versión v1 conservada en el historial del repositorio o solicitar que se re-expandan antes de ejecutar ese ticket puntual.
