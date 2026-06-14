# Documentación de rediseño UX/UI — Love Arcade Game Hub

## 0. Objetivo del rediseño

El objetivo es reestructurar, rediseñar y mejorar la navegación de Love Arcade para convertir la experiencia actual en un **game hub premium, legible, temático y escalable**, evitando que la interfaz se perciba como una tienda genérica o marketplace tipo e-commerce.

La dirección visual recomendada es:

**Premium Console + Neon Operator**

Esto significa:

- Base oscura, sólida y legible.
- Superficies opacas, no dependientes de glassmorphism.
- Jerarquía cinematográfica para juegos y recompensas.
- Navegación más clara entre jugar, tienda, eventos y progreso.
- Acentos neón controlados, usados solo para estados activos, recompensas y feedback.
- Modularidad tipo bento/dashboard, pero con intención editorial y gamer.

La experiencia debe sentirse como entrar a un **ecosistema de juego**, no como navegar una tienda de productos.

---

## 1. Diagnóstico del estado actual

### 1.1 Fortalezas actuales

La versión actual ya tiene una base visual sólida:

- Identidad reconocible con el logo “Love Arcade”.
- Tema oscuro coherente.
- Uso consistente de violeta como acento principal.
- Bottom navigation clara en móvil.
- Sistema de tarjetas, tabs, badges y botones ya establecido.
- Buen sentido de gamificación: monedas, racha diaria, bono, eventos, tienda y tesoros.
- La UI ya se aleja parcialmente del e-commerce tradicional gracias al HUD de usuario, la racha y la estética arcade.

### 1.2 Problemas principales detectados

#### Problema 1: La navegación conceptual está dividida de forma confusa

Actualmente existen tres destinos principales:

- Inicio
- Tienda
- Eventos

Pero dentro de “Tienda” se mezclan funciones muy distintas:

- Catálogo
- Mis Tesoros
- Sincronizar
- Ajustes
- Tema de color
- Bendición lunar
- Racha diaria
- Economía
- Historial de transacciones

Esto provoca que “Tienda” sea en realidad una mezcla entre marketplace, inventario, cuenta, economía, backup y configuración.

**Riesgo:** el usuario no entiende si está en una tienda, en su perfil, en ajustes o en una sección de progreso.

#### Problema 2: Inicio no funciona suficientemente como hub

La pantalla de inicio tiene elementos valiosos: perfil, monedas, racha y juegos. Sin embargo, debería actuar como un **dashboard de juego** más potente.

Actualmente el home se siente como:

- saludo de usuario
- saldo
- racha
- lista de juegos

Debe evolucionar hacia:

- continuar jugando
- misión/recompensa del día
- juegos destacados
- eventos activos o próximos
- progreso del usuario
- accesos rápidos
- actividad reciente

#### Problema 3: La tienda se parece demasiado a un catálogo de productos

La vista de tienda usa una grilla de ítems con precio, oferta, filtros y búsqueda. Esto es funcional, pero puede acercarse demasiado a un patrón de e-commerce convencional.

Para evitar que parezca Amazon, la tienda debe sentirse como:

- una bóveda
- un arcade shop
- una colección desbloqueable
- un inventario de recompensas
- una economía interna del juego

No como una lista de productos.

#### Problema 4: Exceso de peso visual en elementos secundarios

Algunos elementos tienen demasiado protagonismo visual en relación con su importancia:

- banner de descuento
- tabs internos de tienda
- botones grandes repetidos
- tarjetas de configuración
- bottom nav flotante
- glow violeta en muchos puntos

El resultado es atractivo, pero puede perder jerarquía.

#### Problema 5: Eventos vacíos se sienten demasiado vacíos

La pantalla de eventos sin contenido tiene buen estado vacío, pero se percibe muy pasiva. Una vista de eventos no debería sentirse abandonada cuando no hay eventos activos.

Debe convertirse en un espacio que mantenga interés incluso en estado vacío:

- próximos eventos
- historial de eventos
- recompensas pasadas
- “vuelve pronto” con temporizador
- retos diarios alternativos
- teaser del siguiente evento

#### Problema 6: Ajustes contiene contenido que no debería estar escondido dentro de Tienda

La configuración de tema, bendición lunar, racha diaria, economía e historial de transacciones no pertenecen conceptualmente a “Tienda”.

Estos elementos pertenecen mejor a una sección tipo:

- Perfil
- Cuenta
- Progreso
- Mi Arcade
- Centro de jugador

---

## 2. Nueva arquitectura de información recomendada

### 2.1 Navegación principal propuesta

Para móvil, se recomienda mantener una navegación inferior de 3 a 4 destinos. La estructura ideal depende del alcance que se quiera asumir.

### Opción recomendada: 4 secciones principales

1. **Hub**
2. **Juegos**
3. **Tienda**
4. **Perfil**

Los eventos pueden vivir dentro de Hub como módulo destacado y también tener acceso desde una card o badge cuando existan eventos activos.

#### Por qué esta opción es mejor

- Reduce la carga de “Tienda”.
- Da un lugar natural a ajustes, racha, historial, sincronización y tesoros.
- Convierte Inicio en un verdadero centro de actividad.
- Separa claramente jugar, comprar/desbloquear y gestionar cuenta/progreso.

### 2.2 Alternativa si se deben conservar solo 3 tabs

Si por restricciones técnicas o de producto deben mantenerse solo 3 tabs, se recomienda:

1. **Inicio**
2. **Arcade**
3. **Perfil**

Donde:

- Inicio = dashboard general.
- Arcade = juegos + tienda + recompensas.
- Perfil = tesoros, sincronización, ajustes, historial, racha.

Sin embargo, esta opción puede ser menos clara que la navegación de 4 secciones.

### 2.3 Reestructuración recomendada por contenido

#### Nueva sección: Hub

Debe incluir:

- Saludo del usuario.
- Saldo resumido.
- Racha diaria compacta.
- Recompensa diaria.
- Juego recomendado o “continuar jugando”.
- Juegos populares.
- Eventos activos o próximos.
- Acceso rápido a tienda/perfil si hay recompensas pendientes.

#### Nueva sección: Juegos

Debe incluir:

- Juegos populares.
- Todos los juegos.
- Filtros por categoría, dificultad o tipo.
- Continuar jugando.
- Juegos recientes.
- Estados de progreso por juego.

#### Nueva sección: Tienda

Debe incluir:

- Catálogo de recompensas.
- Ofertas activas.
- Búsqueda.
- Filtros.
- Preview de wallpaper/regalo.
- Confirmación de compra.
- Estado de economía asociado a compra.

No debe incluir ajustes, sync, historial completo ni racha diaria.

#### Nueva sección: Perfil / Mi Arcade

Debe incluir:

- Avatar e identidad.
- Mis Tesoros.
- Sincronización.
- Ajustes visuales.
- Bendición lunar.
- Racha diaria.
- Historial de transacciones.
- Estado de economía.
- Preferencias de notificaciones.

---

## 3. Nueva navegación propuesta

## 3.1 Header superior

### Estado actual

El header superior muestra:

- Logo Love Arcade.
- Badge de monedas.
- Avatar.

### Propuesta

Mantener el header, pero convertirlo en una barra de estado premium.

Debe contener:

- Logo a la izquierda.
- Saldo de monedas a la derecha.
- Avatar con acceso a Perfil.
- Indicador de evento o recompensa pendiente si aplica.

### Cambios específicos

1. Reducir ligeramente el glow permanente del saldo.
2. Mantener el badge de monedas siempre visible.
3. Hacer que el avatar sea un acceso claro a Perfil.
4. Si hay recompensa diaria disponible, mostrar un pequeño punto o anillo luminoso en el avatar o en el saldo.
5. En pantallas internas, mantener el header fijo pero más compacto.

### Especificación visual

- Fondo: `#0B0D14` o `#090A10`.
- Borde inferior: 1px sólido con violeta muy sutil.
- Altura móvil recomendada: 72–80px.
- Logo: blanco + acento violeta.
- Saldo: pill oscuro con borde violeta y número dorado.
- Avatar: círculo con aro de acento, sin glow excesivo.

---

## 3.2 Bottom navigation

### Estado actual

La navegación inferior tiene 3 ítems:

- Inicio
- Tienda
- Eventos

El estado activo usa un gran pill con gradiente violeta/azul.

### Propuesta recomendada

Cambiar a 4 ítems:

- Hub
- Juegos
- Tienda
- Perfil

O, si se conserva el naming actual:

- Inicio
- Juegos
- Tienda
- Perfil

### Razón

“Eventos” no necesita ser un destino permanente si muchas veces estará vacío. En cambio, Perfil sí necesita presencia permanente porque agrupa múltiples funciones actualmente escondidas en tienda.

### Comportamiento recomendado

- El ítem activo debe tener label visible.
- Los ítems inactivos pueden mostrar solo icono o icono + label pequeño según espacio.
- La barra debe tener estado fijo inferior.
- Debe respetar safe-area en móviles.
- Debe tener fondo sólido opaco, no glass.

### Especificación visual

- Contenedor: `position: fixed; bottom: 16px;`
- Fondo: `#151827`.
- Borde: `1px solid rgba(155, 100, 255, 0.18)`.
- Radio: 999px.
- Activo: gradiente violeta/azul.
- Iconos inactivos: `#AEB7D0`.
- Texto activo: blanco.
- Glow solo en activo, intensidad baja.

### Reglas de UX

- No usar más de 4 ítems en bottom nav.
- No incluir sub-tabs dentro de bottom nav.
- No usar labels ambiguos como “Más”.
- El botón activo debe ser reconocible sin depender solo del color.

---

## 4. Rediseño de la sección Hub / Inicio

## 4.1 Objetivo

Inicio debe ser el centro de mando del jugador. Debe responder rápidamente:

- ¿Qué puedo jugar ahora?
- ¿Qué recompensa puedo reclamar?
- ¿Qué progreso tengo?
- ¿Hay algo nuevo o temporal?
- ¿Dónde continúo?

## 4.2 Estructura propuesta de Hub

Orden recomendado:

1. Header global.
2. Hero compacto de jugador.
3. Card de recompensa diaria / racha.
4. Continuar jugando.
5. Juegos populares.
6. Eventos o retos activos.
7. Más juegos.

## 4.3 Hero de jugador

### Estado actual

El HUD de usuario ocupa un bloque grande con:

- Avatar.
- Saludo.
- Estado online.
- Monedas.
- Bono diario.
- Racha.

Es atractivo, pero demasiado grande para la función que cumple.

### Propuesta

Dividir el HUD actual en dos componentes:

1. **Player Summary Card**
2. **Daily Reward Card**

### Player Summary Card

Debe mostrar:

- Avatar.
- Nombre.
- Estado.
- Nivel o rango, si existe o se puede añadir.
- Saldo resumido.
- Acceso a Perfil.

#### Layout recomendado

Card horizontal compacta:

```text
[Avatar]  Bienvenid@, Baity
          En línea · Love Arcade
          Nivel / rango / nube activa

[Saldo] [Perfil]
```

### Daily Reward Card

Debe mostrar:

- Recompensa disponible.
- Racha semanal.
- Botón reclamar.
- Estado del siguiente claim.

#### Reglas

- Si el bono está disponible, el CTA debe ser primario.
- Si ya fue reclamado, mostrar countdown.
- La racha debe ser visual, pero compacta.
- Evitar que el bono diario compita con la lista de juegos.

---

## 4.4 Continuar jugando

Actualmente la home muestra “Juegos populares” y “Más juegos”, pero no parece priorizar la continuidad.

### Nuevo módulo recomendado

Agregar un módulo “Continuar jugando”.

Debe aparecer por encima de “Juegos populares” si el usuario ya jugó algo.

Contenido:

- Cover del último juego.
- Nombre del juego.
- Último nivel o progreso.
- Recompensa pendiente si existe.
- CTA “Continuar”.

### Estado vacío

Si no hay historial:

- Mostrar “Empieza tu primera partida”.
- Recomendar el juego más popular o más corto.

---

## 4.5 Juegos populares

### Estado actual

Hay una card grande de juego popular y una segunda card parcialmente visible horizontalmente. Visualmente funciona bien, pero puede mejorar en jerarquía y control de scroll.

### Propuesta

Mantener una composición tipo carrusel editorial:

- Primera card grande destacada.
- Segunda y tercera card parcialmente visibles.
- Indicador de scroll o dots sutiles.
- CTA sobre la card o debajo de ella.

### Cambios visuales

- Usar bordes más premium: 1px sutil, sin glow fuerte.
- Añadir metadatos: “Puzzle”, “Rápido”, “+100 monedas”, “Nuevo”.
- Añadir estado de progreso si el usuario ya jugó.
- Mantener imagen grande como protagonista.

---

## 4.6 Más juegos

### Estado actual

La sección “Más Juegos” presenta cards cuadradas grandes con imágenes.

### Propuesta

Convertirla en una grilla de tiles con mejor información.

Cada tile debe incluir:

- Imagen.
- Nombre del juego.
- Categoría.
- Estado: nuevo, jugado, progreso, recompensa.
- CTA al tocar toda la card.

### Reglas visuales

- No depender solo de la imagen.
- Añadir overlays opacos en la parte inferior para texto.
- Mantener radio grande, pero no excesivo.
- Evitar cards mudas sin contexto.

---

## 5. Rediseño de Juegos

## 5.1 Objetivo

La sección Juegos debe ser el lugar principal para explorar y jugar. Debe tener más protagonismo que la tienda.

## 5.2 Estructura recomendada

1. Header interno: “Juegos”.
2. Search compacta: “Buscar juego”.
3. Filtros por tipo.
4. Continuar jugando.
5. Populares.
6. Todos los juegos.

## 5.3 Filtros sugeridos

- Todos
- Puzzle
- Arcade
- Acción
- Rápidos
- Nuevos
- Con recompensas

## 5.4 Card de juego recomendada

Cada card debe tener:

- Cover.
- Nombre.
- Categoría.
- Tiempo estimado o dificultad.
- Recompensa posible.
- Estado de progreso.

Ejemplo:

```text
[Cover]
Word Hunt
Puzzle · 3 min
+100 monedas disponibles
[Continuar]
```

## 5.5 Evitar patrón marketplace

No mostrar los juegos como productos con precio. Los juegos son experiencias, no mercancía. Deben priorizar:

- acción de jugar
- progreso
- reto
- recompensa
- comunidad/amigos si aplica

---

## 6. Rediseño de Tienda

## 6.1 Objetivo

La tienda debe sentirse como una **bóveda arcade de recompensas**, no como una tienda e-commerce tradicional.

## 6.2 Nueva narrativa

Renombrar o subtitular la tienda como:

- “Arcade Shop”
- “Bóveda”
- “Recompensas”
- “Catálogo de Tesoros”

Recomendación:

**Tienda** como label principal para claridad, pero dentro usar el concepto **Bóveda de Tesoros**.

## 6.3 Estructura recomendada

1. Banner de oferta compacto.
2. Saldo disponible + acceso a código promocional.
3. Categorías.
4. Catálogo.
5. Ofertas destacadas.
6. Preview / compra.

## 6.4 Banner de descuento

### Estado actual

El banner “10% OFF” tiene buena presencia, pero ocupa mucho espacio y se repite en diferentes subpáginas.

### Propuesta

Mantenerlo solo en Tienda, no en Sync, Ajustes o Perfil.

#### Cambios

- Reducir altura.
- Hacerlo colapsable.
- Convertir el código promocional en acción secundaria dentro del banner o debajo del saldo.
- No mostrarlo en pantallas que no sean de compra.

## 6.5 Código promocional

### Estado actual

Aparece como fila “¿Tienes un código promocional?” con expansión.

### Propuesta

Moverlo a una ubicación más contextual:

- Dentro del banner de oferta.
- O como link secundario cerca del saldo.

Texto sugerido:

- “Canjear código”
- “Tengo un código”

Evitar que ocupe una fila completa si está cerrado.

## 6.6 Tabs internos actuales

Actualmente la tienda tiene tabs:

- Catálogo
- Mis Tesoros
- Sincronizar
- Ajustes

### Cambio recomendado

Eliminar estos tabs de Tienda.

La tienda solo debe tener:

- Catálogo
- Ofertas
- Categorías
- Detalle/preview

“Mis Tesoros”, “Sincronizar” y “Ajustes” deben moverse a Perfil.

## 6.7 Search y filtros

### Estado actual

La búsqueda dice “Buscar wallpaper...” y los filtros incluyen nuevos, regalos, avatar, móvil, PC, todos.

### Propuesta

Mejorar el texto y la jerarquía:

- Placeholder: “Buscar recompensa, wallpaper o avatar…”
- Filtros como chips de categoría.
- Mantener “Todos” primero o último, pero de forma consistente.

Orden sugerido:

1. Todos
2. Nuevos
3. Ofertas
4. Wallpapers
5. Avatar
6. Móvil
7. PC
7. Regalos

## 6.8 Cards de tienda

### Estado actual

Las cards son claras, pero se parecen mucho a producto de tienda: imagen, nombre, precio anterior, precio actual, botón de compra.

### Propuesta

Convertirlas en “recompensas desbloqueables”.

Cada card debe tener:

- Imagen.
- Badge contextual: Oferta, Nuevo, Limitado, Tuyo.
- Nombre.
- Tipo: Wallpaper, Avatar, Regalo.
- Precio.
- Estado: disponible, comprado, bloqueado o insuficiente.
- Acción principal.
- Acción secundaria de preview.

### Botones

Cambiar de botón genérico con precio a botones más temáticos:

- “Desbloquear”
- “Obtener”
- “Comprar con monedas”
- “Ver preview”

El precio puede mantenerse dentro del botón, pero acompañado de un verbo.

Ejemplo:

```text
[Imagen]
Sonic the Hedgehog       [OFERTA]
Wallpaper · Móvil/PC
99 monedas
[Desbloquear]
[Vista previa]
```

### Estados de card

#### Disponible

- Botón primario violeta.
- Precio visible.

#### Oferta

- Badge dorado.
- Precio anterior tachado.
- Precio actual en verde o dorado.

#### Comprado

- Badge verde “Tuyo”.
- Botón “Usar” o “Descargar”.
- No mostrar precio como CTA.

#### Insuficiente saldo

- Botón deshabilitado.
- Texto: “Faltan X monedas”.
- Acción alternativa: “Jugar para ganar”.

#### Bloqueado

- Overlay oscuro opaco.
- Requisito claro: “Requiere racha de 7 días” o “Completa 3 partidas”.

---

## 7. Rediseño de Mis Tesoros

## 7.1 Ubicación recomendada

Mover “Mis Tesoros” desde Tienda hacia Perfil.

Debe ser una subsección importante del perfil, no una pestaña dentro de tienda.

## 7.2 Objetivo

Mostrar todo lo que el usuario ya desbloqueó.

## 7.3 Estructura

1. Header: “Mis Tesoros”.
2. Resumen: cantidad de objetos desbloqueados.
3. Filtros: Todos, Wallpapers, Avatares, Regalos.
4. Grid de ítems.
5. Estado vacío si no hay tesoros.

## 7.4 Card de tesoro

Cada card debe incluir:

- Imagen.
- Badge “Tuyo”.
- Nombre.
- Tipo.
- Botón principal: Descargar / Usar.
- Botón secundario: Enviar / Compartir.

### Mejoras visuales

- El botón verde de descargar funciona, pero debe reservarse solo para acciones de descarga/confirmación positiva.
- Si el objeto puede aplicarse como avatar o tema, usar “Usar” como CTA principal.
- Si es wallpaper, usar “Descargar”.

---

## 8. Rediseño de Perfil / Mi Arcade

## 8.1 Objetivo

Perfil debe ser el centro del usuario, su progreso y su configuración.

## 8.2 Contenido que debe moverse aquí

Desde Tienda/Ajustes:

- Mis Tesoros.
- Sincronización.
- Tema de color.
- Bendición lunar.
- Racha diaria.
- Estado de economía.
- Historial de transacciones.
- Notificaciones.
- Identidad/avatar.

## 8.3 Estructura recomendada

1. Player Profile Header.
2. Progreso y economía.
3. Mis Tesoros.
4. Sincronización.
5. Personalización.
6. Historial.
7. Ajustes avanzados.

## 8.4 Player Profile Header

Debe mostrar:

- Avatar.
- Nombre.
- Estado de nube.
- Saldo.
- Racha.
- Editar perfil.

## 8.5 Sección Progreso

Debe agrupar:

- Racha diaria.
- Bendición lunar.
- Bonos activos.
- Eventos completados.
- Total ganado.

## 8.6 Sección Economía

Debe agrupar:

- Descuento activo.
- Cashback activo.
- Bendición lunar.
- Historial de transacciones.

### Recomendación importante

El “Historial de transacciones” no debe aparecer como una card enorme si hay muchas entradas. Debe ser una lista compacta con opción “Ver todo”.

## 8.7 Tema de color

### Estado actual

La elección de color aparece con opciones:

- Violeta
- Rosa Neón
- Cyan Arcade
- Dorado
- Carmesí

### Propuesta

Mantener esta funcionalidad en Perfil > Personalización.

Mejorar el patrón visual:

- Mostrar cada color como swatch + nombre.
- Indicar selección con check y borde.
- Añadir preview pequeño de cómo cambia el botón activo.
- Evitar que las opciones ocupen demasiado espacio vertical.

---

## 9. Rediseño de Sincronización

## 9.1 Ubicación recomendada

Mover a Perfil > Sincronización.

## 9.2 Diagnóstico

La pantalla actual de sincronización es funcional y comunica bien:

- exportar
- importar
- nube
- checksum
- anti-edición

Pero visualmente puede sentirse demasiado técnica para usuarios casuales.

## 9.3 Propuesta

Dividir en dos niveles:

### Nivel simple

Mostrar primero:

- Estado: “Sincronizado” / “No sincronizado”.
- Última sincronización.
- CTA: “Sincronizar ahora” o “Gestionar cuenta”.

### Nivel avanzado

Luego, en acordeón o sección secundaria:

- Exportar partida.
- Importar partida.
- Checksum SHA-256.
- Anti-edición.

## 9.4 Copy recomendado

Cambiar lenguaje técnico expuesto por defecto:

- “Exportar partida” está bien.
- “Checksum SHA-256” puede mantenerse como badge, pero no debe ser protagonista.
- “Anti-edición” puede cambiar a “Protección activa”.

Ejemplo:

```text
Sincronización
Tu progreso está protegido y disponible entre dispositivos.
Estado: En línea
Última sincronización: 18-may, 01:12 p.m.
[Gestionar cuenta]

Opciones avanzadas
[Exportar respaldo] [Importar respaldo]
```

---

## 10. Rediseño de Eventos

## 10.1 Problema actual

Cuando no hay eventos activos, la pantalla se siente vacía y desconectada del resto del hub.

## 10.2 Propuesta

Eventos debe ser una experiencia dinámica, incluso sin eventos activos.

### Si hay eventos activos

Mostrar:

- Hero del evento principal.
- Tiempo restante.
- Misiones.
- Recompensas.
- Progreso.
- CTA principal.

### Si no hay eventos activos

Mostrar:

- Estado vacío más rico.
- Próximo evento si existe.
- Retos diarios alternativos.
- Historial de eventos pasados.
- CTA a juegos para ganar monedas.

## 10.3 Estructura recomendada en estado vacío

```text
[Badge] Sin eventos activos
Eventos
Pronto habrá nuevas bonificaciones.

[Card] Mientras tanto...
Completa juegos para aumentar tu racha y ganar monedas.
[Jugar ahora]

[Card] Próximamente
Nuevos retos temporales aparecerán aquí.
[Activar notificaciones]
```

## 10.4 Si Eventos deja de ser tab principal

Si se adopta la navegación de 4 secciones, eventos debe aparecer en:

- Módulo del Hub.
- Card destacada cuando haya evento activo.
- Badge temporal en bottom nav sobre Hub o Juegos.
- Acceso desde Perfil si se consulta historial.

---

## 11. Sistema visual recomendado

## 11.1 Dirección visual

**Dark luxury + Bento premium + HUD sci-fi + Neon controlado**

## 11.2 Principios

1. Superficies sólidas antes que transparentes.
2. Neón solo para interacción, estado y recompensa.
3. Imágenes de juegos como protagonistas.
4. Cards con jerarquía clara.
5. Menos glow permanente, más glow contextual.
6. Botones con verbos de acción, no solo precios.
7. UI gamer, pero madura y legible.

## 11.3 Paleta recomendada

### Base

- Fondo principal: `#06070D`
- Fondo elevado: `#10131E`
- Superficie card: `#151827`
- Superficie card elevada: `#1B2032`
- Borde sutil: `rgba(160, 125, 255, 0.18)`

### Texto

- Texto principal: `#F4F6FF`
- Texto secundario: `#B8C0D8`
- Texto terciario: `#7F89A6`
- Texto deshabilitado: `#555E76`

### Acentos

- Violeta principal: `#8B4DFF`
- Azul eléctrico: `#3E68FF`
- Cyan opcional: `#20D7FF`
- Dorado recompensa: `#FFC447`
- Verde éxito: `#20C878`
- Rojo alerta/oferta limitada: `#FF3D67`

## 11.4 Uso del color

- Violeta: navegación activa, CTA principal, selección.
- Dorado: monedas, ofertas, recompensas.
- Verde: comprado, sincronizado, éxito.
- Cyan: nube, sync, estado técnico.
- Rojo/rosa: eventos urgentes, errores, ofertas especiales.

## 11.5 Glassmorphism

Debe evitarse como base del sistema.

Permitido solo en:

- pequeños highlights decorativos.
- overlays muy oscuros sobre imágenes.
- modales con fondo blur muy leve.

No usar glassmorphism en:

- cards con texto importante.
- navegación principal.
- botones primarios.
- listas de catálogo.
- módulos de progreso.

## 11.6 Bordes y glow

- Usar bordes de 1px con opacidad baja.
- Glow solo en elementos activos o recompensas reclamables.
- Evitar que todas las cards brillen al mismo tiempo.

## 11.7 Radio

- Cards principales: 24–28px.
- Cards secundarias: 18–22px.
- Chips/pills: 999px.
- Imágenes dentro de card: 14–18px.

## 11.8 Sombras

Usar sombras profundas pero suaves:

- Cards: sombra negra sutil.
- CTA activo: glow violeta moderado.
- Recompensas: glow dorado puntual.

---

## 12. Tipografía

## 12.1 Jerarquía recomendada

### H1 móvil

- Tamaño: 32–40px.
- Peso: 800.
- Línea: 1.05–1.15.

### H2

- Tamaño: 24–30px.
- Peso: 800.

### H3 / títulos de cards

- Tamaño: 18–22px.
- Peso: 700.

### Body

- Tamaño: 15–17px.
- Peso: 400–500.
- Línea: 1.45–1.6.

### Metadata

- Tamaño: 12–14px.
- Peso: 600.
- Letter spacing leve.

## 12.2 Reglas

- Evitar demasiadas mayúsculas en textos largos.
- Usar mayúsculas solo para badges o etiquetas técnicas.
- Mantener contraste alto en todos los textos.
- No colocar texto claro sobre imágenes sin overlay opaco.

---

## 13. Componentes del sistema

## 13.1 Botones

### Primario

Uso:

- Jugar.
- Continuar.
- Desbloquear.
- Reclamar.

Visual:

- Gradiente violeta/azul.
- Texto blanco.
- Altura mínima 48px.
- Radio 14–18px.
- Peso 700.

### Secundario

Uso:

- Ver detalles.
- Preview.
- Editar.

Visual:

- Fondo oscuro.
- Borde sutil.
- Texto claro.

### Éxito

Uso:

- Descargar.
- Sincronizado.
- Importar progreso.

Visual:

- Verde sólido.
- Texto oscuro o blanco según contraste.

### Peligro / Alerta

Uso:

- Cancelar cuenta.
- Error.
- Acción irreversible.

Visual:

- Rojo/carmesí.

## 13.2 Chips

Uso:

- filtros
- estados
- categorías
- rareza
- sincronización

Reglas:

- Altura mínima: 36px.
- Tappable en móvil: mínimo 44px si son interactivos.
- Estado activo con fondo acento y borde claro.
- Inactivo con fondo sólido oscuro.

## 13.3 Cards

### Card de juego

Debe priorizar imagen + acción.

### Card de recompensa

Debe priorizar estado + precio + desbloqueo.

### Card de perfil

Debe priorizar datos y configuración.

### Card de evento

Debe priorizar urgencia + tiempo + recompensa.

## 13.4 Modales

Reglas:

- Fondo del overlay oscuro con blur leve.
- Caja modal sólida.
- CTA principal al final.
- Cierre claro.
- Focus trap y accesibilidad preservados.
- No depender de transparencia para legibilidad.

---

## 14. Microinteracciones

## 14.1 Principios

- La UI debe sentirse viva, pero no pesada.
- Las animaciones deben confirmar intención, no distraer.
- Evitar animaciones permanentes en muchos elementos.

## 14.2 Interacciones recomendadas

### Botones

- Press scale: `0.97`.
- Hover glow suave.
- Loading con spinner pequeño o shimmer.

### Cards

- Hover/tap: elevar 2–4px.
- Imagen con zoom muy leve.
- Border accent en hover.

### Recompensa diaria

- Glow dorado solo si reclamable.
- Animación corta al reclamar.
- Toast con resumen de monedas ganadas.

### Cambio de tab/sección

- Transición opacity + translateY.
- Duración: 180–240ms.

### Bottom nav

- Indicador activo animado.
- Sin movimiento excesivo.

---

## 15. Accesibilidad

## 15.1 Contraste

- Todo texto debe cumplir contraste alto sobre fondos oscuros.
- No colocar texto gris bajo sobre violeta oscuro.
- Evitar texto pequeño sobre imágenes.

## 15.2 Tacto móvil

- Área mínima interactiva: 44x44px.
- Separación suficiente entre chips.
- Bottom nav alejada del borde inferior con safe-area.

## 15.3 Estados de foco

- Mantener `focus-visible` en botones, links, tabs, chips y cards interactivas.
- El foco debe ser visible sin depender del hover.

## 15.4 Modales

Preservar:

- bloqueo de fondo.
- retorno al trigger.
- Escape para cerrar si aplica.
- labels claros.

## 15.5 Reduce motion

- Respetar `prefers-reduced-motion`.
- Desactivar glows animados, particles y transiciones largas.

---

## 16. Estados que deben diseñarse

Cada componente crítico debe tener estos estados:

- Default.
- Hover.
- Pressed.
- Focus visible.
- Loading.
- Disabled.
- Empty.
- Error.
- Success.
- Purchased / Owned.
- Insufficient funds.
- Locked.
- Active.
- Inactive.

## 16.1 Estados específicos por sección

### Hub

- usuario nuevo.
- usuario con progreso.
- recompensa disponible.
- recompensa ya reclamada.
- sin juegos recientes.
- con evento activo.
- sin evento activo.

### Juegos

- sin historial.
- búsqueda sin resultados.
- juego nuevo.
- juego con progreso.
- juego con recompensa pendiente.

### Tienda

- cargando catálogo.
- error catálogo.
- catálogo vacío.
- oferta activa.
- ítem comprado.
- saldo insuficiente.
- preview abierto.
- compra confirmada.

### Perfil

- nube conectada.
- nube desconectada.
- importación exitosa.
- importación fallida.
- sin tesoros.
- historial vacío.

### Eventos

- sin eventos.
- evento activo.
- evento expirado.
- misión reclamada.
- misión bloqueada.
- countdown finalizado.

---

## 17. Copywriting recomendado

## 17.1 Tono

Debe ser:

- gamer
- cálido
- premium
- directo
- no infantil
- no técnico salvo en modo avanzado

## 17.2 Ejemplos de reemplazo

### Inicio

Actual: “Juegos Populares”

Propuesta:

- “Populares del Arcade”
- “Juegos destacados”
- “Entra al juego”

### Más Juegos

Propuesta:

- “Explora más juegos”
- “Más mundos para jugar”

### Tienda

Actual: “Catálogo”

Propuesta:

- “Bóveda”
- “Recompensas”
- “Catálogo de tesoros”

### Mis Tesoros

Mantener, es buen naming.

### Sincronizar

Propuesta:

- “Progreso”
- “Sincronización”
- “Respaldo de partida”

### Ajustes

Propuesta:

- “Personalización”
- “Cuenta”
- “Preferencias”

### Eventos vacíos

Actual: “No hay eventos activos en este momento.”

Propuesta:

- “El arcade está cargando el próximo evento.”
- “Mientras tanto, completa partidas para subir tu racha y ganar monedas.”

---

## 18. Recomendaciones por pantalla actual

## 18.1 Pantalla Home actual

### Cambios requeridos

1. Reducir el tamaño del HUD principal.
2. Separar perfil y recompensa diaria.
3. Añadir módulo “Continuar jugando”.
4. Añadir metadata a juegos.
5. Dar mayor intención editorial a “Juegos Populares”.
6. Convertir “Más Juegos” en una grilla informativa, no solo imágenes.
7. Mantener bottom nav, pero evaluar cambio a 4 secciones.

### Resultado esperado

Home pasa de ser una portada con juegos a un verdadero centro de mando.

---

## 18.2 Pantalla Tienda / Catálogo actual

### Cambios requeridos

1. Quitar “Mis Tesoros”, “Sincronizar” y “Ajustes” de la tienda.
2. Reducir banner de descuento.
3. Mover código promocional a acción secundaria.
4. Mejorar placeholder de búsqueda.
5. Cambiar cards de producto a cards de recompensa.
6. Cambiar CTA de precio a acción: “Desbloquear”.
7. Mejorar estados de comprado, insuficiente, oferta y preview.
8. Evitar que la tienda parezca marketplace.

### Resultado esperado

La tienda se siente como una bóveda de desbloqueables dentro del juego.

---

## 18.3 Pantalla Eventos actual

### Cambios requeridos

1. Enriquecer estado vacío.
2. Añadir CTA hacia juegos.
3. Añadir anticipación de próximos eventos si existe data.
4. Mostrar historial o recompensas pasadas si aplica.
5. Considerar remover Eventos como tab fijo si suele estar vacío.

### Resultado esperado

Eventos mantiene valor incluso sin eventos activos.

---

## 18.4 Pantalla Mis Tesoros actual

### Cambios requeridos

1. Mover a Perfil.
2. Añadir resumen de colección.
3. Añadir filtros por tipo.
4. Diferenciar “Usar”, “Descargar” y “Enviar”.
5. Mejorar estado vacío.

### Resultado esperado

Mis Tesoros se percibe como inventario del jugador, no como subpestaña de tienda.

---

## 18.5 Pantalla Sincronizar actual

### Cambios requeridos

1. Mover a Perfil.
2. Separar modo simple y modo avanzado.
3. Reducir protagonismo de términos técnicos.
4. Mostrar estado de nube primero.
5. Mantener exportar/importar como opciones avanzadas.

### Resultado esperado

Sincronización se vuelve más comprensible para usuarios casuales sin perder funcionalidad técnica.

---

## 18.6 Pantalla Ajustes actual

### Cambios requeridos

1. Mover a Perfil.
2. Separar ajustes visuales, economía y progreso.
3. Reducir altura de Tema de color.
4. Convertir Bendición Lunar en beneficio activo dentro de Progreso/Economía.
5. Convertir Racha Diaria en módulo de progreso.
6. Convertir Historial en lista compacta con “Ver todo”.

### Resultado esperado

Ajustes deja de ser un contenedor mixto y se transforma en Perfil/Mi Arcade.

---

## 19. Propuesta de wireframe textual

## 19.1 Hub

```text
[Header: Logo]                         [Monedas] [Avatar]

Hola, Baity
Lista para jugar hoy

[Card: Continuar jugando]
Word Hunt
Nivel 3 · +100 monedas disponibles
[Continuar]

[Card: Recompensa diaria]
Racha: LU MA MI JU VI SA DO
Bono disponible: +110
[Reclamar]

Populares del Arcade
[Card grande juego] [Card juego] [Card juego]

Eventos y retos
[Si activo: evento]
[Si vacío: próximo reto + jugar ahora]

Explora más juegos
[Grid de juegos]
```

## 19.2 Juegos

```text
[Header]
Juegos
Busca tu próxima partida

[Buscar juego]
[Todos] [Puzzle] [Arcade] [Nuevos] [Con recompensas]

Continuar jugando
[Card horizontal]

Todos los juegos
[Grid]
```

## 19.3 Tienda

```text
[Header]
Tienda
Bóveda de recompensas

[Saldo disponible] [Canjear código]
[Banner oferta compacto]

[Buscar recompensa]
[Todos] [Ofertas] [Wallpapers] [Avatar] [PC] [Móvil]

Recompensas destacadas
[Grid cards]
```

## 19.4 Perfil

```text
[Header]
Mi Arcade
[Avatar] Baity
En línea · Nube activa
[Editar perfil]

Resumen
[Monedas] [Racha] [Tesoros] [Bonos]

Mis Tesoros
[Preview de colección] [Ver todo]

Progreso
[Racha diaria]
[Bendición lunar]

Sincronización
Estado: sincronizado
[Gestionar]

Personalización
Tema de color
[Swatches]

Historial
[Últimos movimientos]
[Ver todo]
```

---

## 20. Recomendaciones técnicas para implementación

## 20.1 Mantener hooks existentes

No romper selectores usados por JavaScript:

- `data-view`
- ids de vistas existentes
- clases de tabs actuales hasta migrar lógica
- ids de modales
- estados `active`, `is-active`, `hidden`, `disabled`
- atributos `data-loading`

## 20.2 Migración por fases

### Fase 1: Sistema visual

- Ajustar tokens CSS.
- Reducir glass/glow.
- Normalizar cards, botones, chips.
- Definir nuevos estados.

### Fase 2: Navegación

- Decidir entre 3 o 4 destinos.
- Crear nueva sección Perfil.
- Reubicar contenido de tienda.
- Ajustar router SPA.

### Fase 3: Home como Hub

- Rediseñar HUD.
- Agregar Continuar jugando.
- Reorganizar juegos y eventos.

### Fase 4: Tienda como Bóveda

- Limpiar tabs.
- Rediseñar cards.
- Mejorar estados de compra.
- Contextualizar promo code.

### Fase 5: Perfil

- Integrar Mis Tesoros.
- Integrar Sync.
- Integrar Ajustes.
- Integrar historial/economía.

### Fase 6: Eventos

- Rediseñar estado vacío.
- Crear módulos de evento activo/próximo.
- Integrar eventos en Hub.

## 20.3 Riesgos técnicos

- La lógica actual puede depender de tabs dentro de tienda.
- Mover secciones requiere actualizar router, estados activos y scroll behavior.
- Los modales deben conservar accesibilidad.
- Las cards dinámicas de tienda y eventos dependen de JSON y runtime.
- La navegación inferior debe sincronizarse con History API.

## 20.4 Recomendación de implementación progresiva

No rehacer todo de una sola vez. Primero separar conceptualmente Perfil de Tienda, luego mejorar la estética.

Orden de mayor impacto:

1. Crear Perfil / Mi Arcade.
2. Mover Ajustes, Sync y Mis Tesoros.
3. Limpiar Tienda.
4. Reestructurar Home.
5. Mejorar Eventos.
6. Pulir sistema visual.

---

## 21. Checklist para diseño

- [ ] Definir navegación final: 3 o 4 tabs.
- [ ] Crear wireframes de Hub, Juegos, Tienda y Perfil.
- [ ] Diseñar estados de cards de tienda.
- [ ] Diseñar estados de eventos.
- [ ] Diseñar cards de juego con metadata.
- [ ] Diseñar perfil con progreso y tesoros.
- [ ] Crear sistema de tokens visuales.
- [ ] Reducir dependencia de glassmorphism.
- [ ] Verificar contraste de todos los textos.
- [ ] Diseñar responsive mobile-first.
- [ ] Crear variantes para empty/error/loading.
- [ ] Documentar componentes reutilizables.

---

## 22. Checklist para programación

- [ ] Revisar dependencias JS de tabs actuales.
- [ ] Crear nueva vista SPA para Perfil si se adopta 4-tab nav.
- [ ] Actualizar `spa-router.js` para nuevas rutas.
- [ ] Actualizar bottom nav y estados activos.
- [ ] Mover markup de Sync, Ajustes y Mis Tesoros fuera de Shop.
- [ ] Mantener modales globales existentes.
- [ ] Actualizar nombres de tabs y labels.
- [ ] Revisar localStorage y datos asociados a tienda/perfil.
- [ ] Validar PWA y service worker tras cambios.
- [ ] Mantener `prefers-reduced-motion`.
- [ ] Validar focus trap de modales.
- [ ] Testear navegación back/forward.
- [ ] Testear mobile real con viewport estrecho.

---

## 23. Resumen ejecutivo

La UI actual de Love Arcade tiene una identidad atractiva y una buena base dark/neon, pero la arquitectura mezcla demasiadas funciones dentro de Tienda. Para elevarla a un game hub premium, se recomienda separar claramente:

- **Hub:** centro de actividad.
- **Juegos:** exploración y continuidad de partidas.
- **Tienda:** bóveda de recompensas.
- **Perfil:** progreso, tesoros, sincronización y ajustes.

El rediseño debe mantener la estética oscura y violeta, pero con menos glassmorphism, menos glow permanente y más jerarquía. La experiencia debe sentirse como una consola arcade premium: clara, gamer, táctil, emocional y legible.

