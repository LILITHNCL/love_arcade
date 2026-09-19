# Política de documentación

## Propósito

Este documento define reglas breves para mantener una documentación clara, consistente y accionable para Love Arcade.

## Principios

1. El código y la configuración actuales son la autoridad.
2. Cada conocimiento debe tener un único documento propietario.
3. Los comentarios de código explican la implementación local; los archivos de documentación describen contratos y límites.
4. Los tickets y las propuestas históricas no forman parte de la documentación normativa.
5. Las afirmaciones no verificables deben marcarse como `revisión humana`.

## Reglas de mantenimiento

- Crear un documento solo cuando responda a una necesidad recurrente y no duplique otro archivo.
- Actualizarlo cuando cambie un contrato público, un formato de datos, una ruta de ejecución o una regla de negocio.
- Consolidar la documentación de arquitectura, dominio, integración y despliegue en los documentos normativos dedicados.
- Eliminar documentos históricos o tickets si ya no se usan como contrato y si su contenido no aporta una regla operativa vigente.

## Validación documental mínima autorizada

Antes de fusionar cambios de documentación, se debe comprobar:

- que no haya enlaces internos rotos;
- que no haya referencias a archivos eliminados o movidos;
- que los nombres de símbolos públicos citados existan en el código actual;
- que no haya tickets, propuestas o changelogs mezclados dentro de la documentación normativa.

### Alcance permitido de DOC-008

La validación documental debe ser de bajo coste y determinista. En esta base de código se autoriza:

- comprobación de enlaces Markdown relativos;
- detección de referencias a archivos eliminados o renombrados;
- detección de menciones persistentes a documentos históricos ya retirados del conjunto normativo;
- ejecución del validador de catálogo si se cambia la tienda, reutilizando `tests/shop-catalog-static-qa.mjs` cuando siga siendo válido.

No se debe automatizar:

- generación automática de documentación desde comentarios;
- sincronización de changelogs;
- comprobaciones semánticas que generen falsos positivos;
- validaciones visuales o de diseño que requieran inspección humana.

### Ejecución recomendada

El control puntual autorizado para este repositorio es:

```bash
node tests/documentation-static-qa.mjs
```

La comprobación debe fallar con un mensaje accionable si un enlace apunta a un archivo inexistente o si una referencia normativa vuelve a citar un documento histórico eliminado.

## Referencias cruzadas

- [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/DOMAIN.md](./DOMAIN.md)
- [docs/INTEGRATION.md](./INTEGRATION.md)
- [docs/OPERATIONS.md](./OPERATIONS.md)
- [README.md](../README.md)
