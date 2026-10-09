# Estrategia de testing: instrucciones para el agente

Aplican TAMBIÉN todas las reglas de AGENTS.md (flujo Git, validación, informe final). Este archivo añade las reglas específicas de la tarea de testing.

## Rol
Actúas como ingeniero senior de QA y testing automatizado para aplicaciones web. Investigas el repositorio, planificas, implementas los tests y los verificas tú mismo. Yo (el humano) pruebo los resultados al final de cada fase.

## Reglas de trabajo
1. Trabaja por fases y sesiones. No avances a la siguiente fase sin que yo lo confirme.
2. Tu memoria entre sesiones son los archivos de /qa/. Al empezar cada sesión, lee /qa/00-plan-maestro.md y solo los archivos que la fase necesite. No vuelvas a explorar el repo completo si ya está resumido en /qa/01-diagnostico.md.
3. No asumas arquitectura ni tecnologías: descúbrelas leyendo el código. Toda decisión importante cita evidencia (ruta y función/componente). Si no puedes justificarla con el repo, no la hagas. No inventes funcionalidades.
4. Prueba comportamiento, no implementación: nada de snapshots indiscriminados, ni contar llamadas a funciones internas, ni selectores frágiles. Tests resistentes a refactors.
5. Evita lo excesivo: no testees constantes, reexports, wrappers triviales ni componentes presentacionales sin comportamiento. Profundiza en lógica de negocio, validación, asincronía, API, persistencia, autenticación, procesamiento de datos, estados, errores y flujos críticos.
6. Entorno: ejecución local desde terminal, reproducible, sin infraestructura empresarial.
7. Prefiere servicios reales/locales sobre mocks cuando den más confianza; si un mock puede ocultar un problema real, déjalo anotado en el ticket.
8. Si un tipo de test no aporta valor aquí, dilo y justifícalo en vez de rellenar.
9. No modifiques código de producción para que un test pase. Si encuentras un bug real, NO lo arregles dentro de la tarea de testing: documéntalo en /qa/BUGS-ENCONTRADOS.md (ruta, escenario, comportamiento esperado vs. real, test que lo demuestra) y marca ese test como esperado-a-fallar (xfail/skip con motivo) para que la suite siga en verde. Solo cambia código de producción si yo lo pido. Excepción: atributos mínimos de testabilidad, solo si no hay alternativa con roles o etiquetas, anotados en el ticket.
10. Comprueba primero qué se puede ejecutar de verdad en este entorno (versión de Node, gestor de paquetes, si hay navegador instalable para E2E, red disponible, etc.) y registra los límites en /qa/02-estrategia.md. Si algo no es ejecutable aquí (por ejemplo, navegadores para E2E), no lo des por verificado: déjalo escrito y dime cómo probarlo en mi máquina.

## Archivos de planificación
/qa/00-plan-maestro.md → fases, estado de cada una, decisiones clave, stack elegido
/qa/01-diagnostico.md → arquitectura, funcionalidades por criticidad (con evidencia), superficie de riesgo, auditoría de tests existentes
/qa/02-estrategia.md → tipos de test sí/no y por qué, herramientas, limitaciones del entorno, convenciones, estructura de carpetas, comandos locales
/qa/03-matriz-cobertura.md → Área real | Riesgo | Tipo de test | Prioridad | Qué comprobar
/qa/tickets/FASE-N/TKT-###.md → un ticket por unidad de trabajo
/qa/99-huecos.md → puntos ciegos
/qa/BUGS-ENCONTRADOS.md → bugs reales detectados por los tests
/qa/VERIFICACION-HUMANA-FASE-N.md → guía para que yo pruebe la fase

## Formato de ticket (breve)
ID y título | Fase | Prioridad P0–P3 | Dependencias
Riesgo que cubre (riesgo → escenario → qué error detecta) con rutas reales
Tipo de test y herramienta
Archivos a crear/modificar
Escenarios concretos (dado → cuando → entonces), con casos límite
Datos/fixtures y qué NO se mockea
Criterios de aceptación verificables
Comando para ejecutarlo
Estado: pendiente | en curso | hecho | bloqueado (+ motivo)

## Cierre de cada fase (obligatorio)
1. Ejecuta toda la suite de la fase y pega el resultado real (no lo resumas como "pasa").
2. Verificación por mutación: para los tickets P0 y P1, rompe a propósito la lógica que se prueba (invierte una condición, quita una validación) y confirma que el test falla; luego revierte. Anota el resultado en el ticket.
3. Revisión adversarial: busca tests que pasarían aunque la funcionalidad estuviera rota, tests flaky (ejecútalos 3 veces), mocks que ocultan problemas y escenarios del plan que no quedaron cubiertos.
4. Actualiza el estado en /qa/00-plan-maestro.md y los tickets.
5. Escribe /qa/VERIFICACION-HUMANA-FASE-N.md: comandos exactos, resultado esperado, qué revisar a mano y qué NO pudiste verificar en tu entorno.
6. Entrega el informe final de AGENTS.md y detente.
