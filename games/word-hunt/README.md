# Word Hunt

Juego de búsqueda de palabras de estilo arcade con grid, progreso y recompensa por nivel. El flujo principal está centrado en `index.html`, `styles.css`, `config_levels.js` y `game.js`.

## Entrada y módulos

- `games/word-hunt/index.html`: shell visual y contenedores del juego.
- `games/word-hunt/styles.css`: tema visual y layout del juego.
- `games/word-hunt/config_levels.js`: catálogo de niveles y configuración.
- `games/word-hunt/game.js`: lógica del tablero, selección y progresión.
- `games/word-hunt/antiguos/`: artefactos históricos; no forman parte del flujo actual.

## Controles

- Selección táctil o por ratón sobre el tablero.
- Navegación por pantalla principal, niveles y juego.
- Guardado de progreso local y continuidad al volver al juego.

## Persistencia y economía

- El progreso se guarda en `localStorage` con prefijo del juego.
- La integración económica pertenece al hub global; este README no repite el contrato completo de la plataforma.
- El modo standalone se mantiene si `GameCenter` no está disponible.

## Ejecutar localmente

```bash
cd /workspaces/love_arcade
python3 -m http.server 8080
```

Abre:

```text
http://localhost:8080/games/word-hunt/index.html
```

## Contrato global

Consulta [docs/INTEGRATION.md](../../docs/INTEGRATION.md) para el contrato de integración de minijuegos.

## Riesgos

- Mantener `config_levels.js` consistente con la lista real de niveles y la progression del juego.
- No documentar historial de versiones como si fuera el estado actual del juego.
