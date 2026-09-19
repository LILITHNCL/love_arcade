# 2048

Juego de lógica y pulso de tablero dentro de Love Arcade. El juego usa una vista standalone y se integra con `window.GameCenter` a través del puente de `lumina_bridge.js`.

## Entrada y módulos

- `games/2048/index.html`: shell visual y temas del juego.
- `games/2048/lumina_core.js`: lógica del tablero, movimientos y victoria/derrota.
- `games/2048/lumina_render.js`: render del tablero y animaciones.
- `games/2048/lumina_input.js`: teclado y gestos táctiles.
- `games/2048/lumina_audio.js`: sonidos procedurales.
- `games/2048/lumina_bridge.js`: integración con Love Arcade.

## Controles

- Teclado: flechas o WASD.
- Móvil: swipe horizontal/vertical.
- Salida al hub: enlace o botón de regreso del shell.

## Persistencia y economía

- El estado del juego es local al tablero y no sustituye la economía global.
- La integración con Love Arcade se realiza desde el bridge del juego y no debe duplicar lógica de tienda.
- Si `GameCenter` no está disponible, el juego sigue funcionando en modo standalone.

## Ejecutar localmente

```bash
cd /workspaces/love_arcade
python3 -m http.server 8080
```

Luego abre:

```text
http://localhost:8080/games/2048/index.html
```

## Contrato global

Consulta [docs/INTEGRATION.md](../../docs/INTEGRATION.md) para el contrato de integración de minijuegos.

## Riesgos

- Los cambios de visual y rendimiento deben mantenerse en el juego; no se debe duplicar la economía de plataforma aquí.
- Cualquier ajuste del flujo de recompensa debe estar alineado con el contrato global y no con changelogs históricos.
