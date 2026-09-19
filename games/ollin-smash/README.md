# Ollin Smash

Juego arcade de ruptura de bloques con oleadas infinitas, power-ups y HUD en pantalla. Es un minijuego de Love Arcade con entrada local y adaptación a la economía del hub.

## Entrada y módulos

- `games/ollin-smash/index.html`: shell, overlays y canvas del juego.
- `games/ollin-smash/css/styles.css`: estilos del HUD, overlays y power-ups.
- `games/ollin-smash/js/main.js`: arranque del juego y bucle principal.
- `games/ollin-smash/js/config.js`: constantes del sistema y balance.
- `games/ollin-smash/js/state.js`: estado compartido del juego.
- `games/ollin-smash/js/core/`: físicas y partículass.
- `games/ollin-smash/js/components/`: piezas del juego y entidades.
- `games/ollin-smash/js/ui/interface.js`: DOM y controles del juego.

## Controles

- Móvil: toque y gestos para mover el paddle.
- Escritorio: teclado y ratón según la implementación del juego.
- Pausa y flujo de retorno al hub desde la UI del juego.

## Persistencia y economía

- El juego conserva progreso y estado de sesión de forma local.
- La acreditación de monedas se mantiene con la capa del hub, no con una implementación duplicada en este README.
- El modo standalone debe seguir funcionando sin `GameCenter`.

## Ejecutar localmente

```bash
cd /workspaces/love_arcade
python3 -m http.server 8080
```

Abre:

```text
http://localhost:8080/games/ollin-smash/index.html
```

## Contrato global

Consulta [docs/INTEGRATION.md](../../docs/INTEGRATION.md) para la documentación de integración de minijuegos.

## Riesgos

- No asumir que el HUD o la economía del juego reemplazan la plataforma.
- Mantener la lógica de pausa y de sesión alineada con el estado global del juego.
