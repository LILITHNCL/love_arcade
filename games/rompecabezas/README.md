# Rompecabezas Arcade

Juego de encaje de piezas con catálogo local, generación de niveles y progreso persistente. El flujo principal se aloja en `games/rompecabezas/src/` y su shell se encuentra en `games/rompecabezas/index.html`.

## Entrada y módulos

- `games/rompecabezas/index.html`: shell y carga de estilos.
- `games/rompecabezas/src/main.js`: punto de entrada y orquestación.
- `games/rompecabezas/src/core/PuzzleEngine.js`: motor del puzle y render.
- `games/rompecabezas/src/core/LevelManager.js`: gestión de niveles y carga.
- `games/rompecabezas/src/ui/UIController.js`: pantallas y DOM del juego.
- `games/rompecabezas/src/systems/Storage.js`: persistencia local.
- `games/rompecabezas/src/systems/Economy.js`: integración con la economía del hub.
- `games/rompecabezas/src/systems/AudioSynth.js`: audio procedural.
- `games/rompecabezas/src/style.css`: presentación visual del juego.

## Controles

- Ratón o touch para arrastrar y encajar piezas.
- Pantallas secundarias para menú, ajustes y resumen de nivel.
- Volver al menú principal desde la navegación del juego.

## Persistencia y economía

- El progreso del jugador se guarda de manera local y controlada por el juego.
- La recompensa económica debe seguir el contrato global de `GameCenter` y no duplicar la lógica de la plataforma.
- Si `GameCenter` no está disponible, el juego debe seguir funcionando en modo standalone.

## Ejecutar localmente

```bash
cd /workspaces/love_arcade
python3 -m http.server 8080
```

Abre:

```text
http://localhost:8080/games/rompecabezas/index.html
```

## Contrato global

Consulta [docs/INTEGRATION.md](../../docs/INTEGRATION.md) para la API de integración de minijuegos y el modelo de recompensas.

## Riesgos

- Mantener el catálogo y el progreso en sync con las reglas del juego y la actividad del hub.
- No usar este README como lugar para conservar changelogs o documentación histórica de versiones.
