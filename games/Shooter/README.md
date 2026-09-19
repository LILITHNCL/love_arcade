# Space Shooter

Shooter arcade de oleadas con movimiento, disparo y progresión de puntuación dentro de Love Arcade.

## Entrada y módulos

- `games/Shooter/index.html`: shell del juego y HUD.
- `games/Shooter/css/`: estilos del juego.
- `games/Shooter/js/`: lógica del bucle, entidades, balance y UI.
- `games/Shooter/assets/`: recursos visuales y de audio del juego.

## Controles

- Móvil: joystick izquierdo, apuntado con el derecho, disparo y dash.
- Escritorio: WASD/flechas + ratón + click/espacio.
- Salida: vuelve al hub desde la navegación del juego.

## Persistencia y economía

- Las recompensas del jugador se gestionan desde la capa de integración del hub y no desde una lógica local aislada.
- El juego admite modo standalone, pero la acreditación de monedas depende de `GameCenter`.

## Ejecutar localmente

```bash
cd /workspaces/love_arcade
python3 -m http.server 8080
```

Abre:

```text
http://localhost:8080/games/Shooter/index.html
```

## Contrato global

Consulta [docs/INTEGRATION.md](../../docs/INTEGRATION.md) para el contrato de minijuegos.

## Riesgos

- No duplicar reglas de recompensa ni balance global en el README del juego.
- Mantener la referencia al hub y la integración de economía centralizada.
