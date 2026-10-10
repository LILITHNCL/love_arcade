# Verificación Humana - Fase 2d

## Qué NO se pudo verificar en este entorno (Termux)
- **UI de Bendición Lunar**: La persistencia y economía de la compra/extensión fueron probadas a nivel de modelo de dominio. La UI (notificaciones visuales, actualización reactiva del componente) requiere un navegador real.
- **UI de Canje de Promo**: La validación y normalización se probó a fondo, pero la interacción del usuario con el modal de input y su cerrado tras el canje requiere navegador.
- **Worker Real para Exportar/Importar**: En Termux no tenemos navegador para lanzar el Worker (`sync-worker.js`), por lo que mockeamos la respuesta para probar la rama de fallback del hilo principal (JSON + base64 nativos). Falta probar la serialización con gzip que hace el Worker real.
- **Portapapeles**: La copia al portapapeles (`navigator.clipboard.writeText`) para exportar requiere interacción real de usuario en un entorno seguro (HTTPS).

## Instrucciones para el usuario
> ⚠️ **IMPORTANTE**: Realiza estas pruebas en un entorno local y usa un perfil limpio o exporta tu progreso antes de empezar, ya que alteraremos tu saldo y estado.

### 1. Bendición Lunar
1. Asegúrate de tener al menos 100 monedas en el hub.
2. Abre la tienda y compra la Bendición Lunar (100 ⭐).
3. **Esperado**: Tu saldo debe bajar en 100 y debes ver una notificación de "+7 días".
4. Recarga la página.
5. **Esperado**: La Bendición debe seguir activa y el ítem en la tienda debe indicar que está vigente.

### 2. Códigos Promocionales
1. Abre el modal de canje de códigos.
2. Ingresa ` SOFIA ` (con espacios) y en minúsculas/mayúsculas mixtas, ej. ` sOfIa `.
3. **Esperado**: El sistema debe acreditarte monedas con éxito.
4. Intenta canjear ` SOFIA ` o `sofia` otra vez.
5. **Esperado**: Debe rechazarlo indicando que ya fue canjeado.

### 3. Exportar / Importar (Worker y Clipboard reales)
1. Abre los Ajustes (Settings) en el hub.
2. Haz clic en **Copiar código de partida**.
3. **Esperado**: El navegador debe confirmar que se copió al portapapeles.
4. Pega el código en un bloc de notas. Asegúrate de que parezca una cadena larga en base64.
5. Abre una pestaña de incógnito (perfil limpio), navega a la app, ve a Ajustes y haz clic en **Restaurar partida**.
6. Pega el código que copiaste.
7. **Esperado**: Tu partida se restaura con el saldo e historial exacto.
