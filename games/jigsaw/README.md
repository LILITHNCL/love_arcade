# Jigsaw

Juego de puzzle con catálogo, preparación de niveles, persistencia local y integración con Love Arcade.

## Entrada y módulos

- `games/jigsaw/index.html`: shell y flujo de navegación del juego.
- `games/jigsaw/css/`: presentación visual del catálogo y la partida.
- `games/jigsaw/js/MAREJIG_levels.js`: catálogo y metadata de niveles.
- `games/jigsaw/js/MAREJIG_generator.js`: generación determinista del rompecabezas.
- `games/jigsaw/js/MAREJIG_groups.js`: grupos de piezas y lógica de unión.
- `games/jigsaw/js/MAREJIG_renderer.js`: render del canvas.
- `games/jigsaw/js/MAREJIG_input.js`: interacción táctil/ratón.
- `games/jigsaw/js/MAREJIG_storage.js`: estado local del juego.
- `games/jigsaw/js/MAREJIG_economy.js`: adaptación económica al hub.

## Controles

- Mouse o touch para arrastrar y alinear piezas.
- Volver al menú desde la navegación del juego.
- Persistencia de partida en curso bajo prefijos `MAREJIG_`.

## Persistencia y economía

- El juego guarda progreso localmente con claves propias del juego.
- Las recompensas se reportan mediante el contrato del hub; en modo standalone, no se acreditan monedas globales.
- El flujo principal se mantiene en el catálogo de pendientes y la finalización del nivel.

## Ejecutar localmente

```bash
cd /workspaces/love_arcade
python3 -m http.server 8080
```

Abre:

```text
http://localhost:8080/games/jigsaw/index.html
```

## Validación existente

Se pueden ejecutar comprobaciones del juego desde la carpeta del proyecto:

```bash
node games/jigsaw/tools/validate-levels.mjs
```

También se recomienda revisar la suite de prueba bajo `games/jigsaw/test/` antes de publicar cambios de contenido o balance.

## Contrato global

Consulta [docs/INTEGRATION.md](../../docs/INTEGRATION.md) para la integración de minijuegos.

## Riesgos

- Al añadir niveles, mantener IDs estables y metadata consistente.
- No duplicar reglas económicas ni nombres de contrato globales en este README.
