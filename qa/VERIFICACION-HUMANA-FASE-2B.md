# Verificación Humana: Fase 2b (Economía y Recompensas)

El trabajo de la fase de testing 2b ha concluido. Por favor, realiza los siguientes pasos para validar el funcionamiento en tu entorno:

## Comandos exactos
Para correr toda la suite de Node (incluyendo los nuevos tests de economía):
```bash
npm test
```
**Resultado esperado:**  
`pass 43`, `fail 0`, `todo 10` (los `todo` corresponden a los bugs documentados; si alguno pasa es porque el bug se arregló).

Para correr los tests unitarios de Marejig y comprobar que no se rompió la compatibilidad de juegos:
```bash
npm run test:games
```
**Resultado esperado:**  
`pass 16`, `fail 0`.

Para correr los tests específicos de esta fase uno por uno:
```bash
node --test tests/domain/economy.test.mjs
node --test tests/domain/economy-coins.test.mjs
node --test tests/domain/complete-level.test.mjs
```

## Cómo repetir una mutación (Demostración de robustez)

Para comprobar que los tests realmente están cubriendo la lógica y fallarían si el código estuviera roto, puedes introducir una mutación temporal.

Por ejemplo, quitemos la **idempotencia** de la recompensa de los niveles (el jugador cobraría por el mismo nivel varias veces).

1. Abre `js/domain/game-center.js`.
2. En la función `completeLevel`, comenta la línea 18:
   `// if (Store.getStore().progress[gameId].includes(levelId)) return ...`
3. Ejecuta el test de integración/paridad:
   ```bash
   node --test tests/domain/complete-level.test.mjs
   ```
4. **Verás que falla estrepitosamente**, tanto en la validación local de "idempotente" como en la "Paridad" general contra el Hub.
5. Revierte el cambio en `js/domain/game-center.js` y todo volverá a la normalidad (`git checkout js/domain/game-center.js`).

## Qué no se pudo verificar automatizadamente (Límites del entorno)
- **Persistencia distribuida**: Se evaluó que `Economy` invoca al guardado con la bandera `immediateCloudSync: true`, pero los mocks del store no validan si efectivamente la subida se encola en Sentinel; esto deberá comprobarse en F3 o probarse manualmente.
- **Multitaba real**: Los tests evalúan la pureza de la mutación de estado en un único thread VM, no hay simulación de qué pasa si dos pestañas compran el mismo item de forma concurrente, o completan un nivel al mismo tiempo. El LWW de estado podría sobrescribir un gasto.
