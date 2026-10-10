# TKT-012: Exportar e Importar (Corrupción y Legacy)

**Fase**: F2d
**Matriz de cobertura**: #12
**Prioridad**: P0 (corrupción) / P1 (R3)

## Objetivo
Verificar la robustez de `exportSave` e `importSave` y confirmar si la rama legacy permite inyección de partidas sin checksum (R3).

## Criterios de aceptación
- Ida y vuelta (`importSave(exportSave())`) conserva el estado.
- Entradas no-string, vacías o que no sean base64 válido devuelven error sin mutar el store.
- JSON roto o base64 truncado devuelven error sin mutar el store (P0).
- Checksum alterado es detectado y rechazado sin mutar el store.
- Verificar R3: Importar un base64 de un JSON sin checksum (`{ "coins": 999 }`) se acepta (rama legacy). Confirmar si esto muta el store y registrar bug F2d-01 para evaluación humana.
- Todo ejecutado forzando la rama fallback (worker mockeado que hace reject), para usar sha256 y base64 reales del hilo principal.
- Anotar qué oculta el worker falso: Oculta la compresión gzip (si el worker real la usa, cosa que no hace para export/import según el fallback, pero podría, aunque el fallback asume que no hay gzip sino solo JSON+Base64).

## Tareas
- [x] Crear `tests/domain/save-export-import.test.mjs`.
- [x] Mockear `workerTask` para forzar el fallback y probar el path principal del cliente.
- [x] Escribir aserciones de P0 (corrupción y rechazo).
- [x] Escribir aserción de R3 (legacy payload bypass).
- [x] Ejecutar tests.
- [x] Mutación 1: Quitar verificación de checksum (`payload.checksum !== expected`).
- [x] Mutación 2: Quitar validación de JSON corrupto (quitar bloque `catch` o alterar `typeof data.coins !== 'number'`).
