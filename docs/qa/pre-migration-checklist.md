# Checklist de regresión pre-migración

## Propósito y alcance

Esta es la línea base manual para la modularización planificada de `js/app.js`.
Se ejecuta contra la rama y el commit indicados en el registro para comparar los
tickets posteriores sin cambiar las reglas actuales de economía, persistencia,
UI o sincronización. No sustituye los checks estáticos de `tests/` ni automatiza
ninguno de estos flujos; esa automatización pertenece al Ticket-018.

## Preparación reproducible

1. Servir la raíz del repositorio con `python3 -m http.server 8080` (o
   `npx serve .`) y abrir `http://localhost:8080`.
2. Abrir DevTools para inspeccionar `localStorage`, consola y red. Usar un
   perfil de navegador limpio para cada caso independiente, salvo que el caso
   indique continuar desde el anterior.
3. Para escenarios que requieren saldo, usar un estado de prueba respaldado
   previamente. La clave del hub es `gamecenter_v6_promos`; anotar el valor
   original antes de modificarlo y restaurarlo al terminar.
4. Para el flujo cloud, configurar un entorno de prueba de Supabase con dos
   perfiles/dispositivos y no usar una cuenta de producción. Para el flujo de
   actualización, usar una versión nueva del Service Worker en un entorno de
   prueba.
5. Registrar en cada ejecución navegador, sistema operativo, URL, hora, commit
   y si había sesión cloud. Los pasos que requieren cambio de fecha/hora deben
   hacerse solo en un perfil de prueba y restaurar el reloj al finalizar.

## Casos de regresión

| ID | Escenario y pasos reproducibles | Resultado esperado | Resultado de línea base |
| --- | --- | --- | --- |
| PM-01 | **Primer load sin parpadeo.** En un perfil con tema, saldo, avatar e identidad ya guardados, recargar con DevTools abierto y grabación de pantalla si está disponible. | El primer frame visible ya muestra el tema guardado, saldo formateado, estado correcto del botón diario, avatar e identidad; no aparece brevemente el tema violeta ni saldo `0`, ni hay salto visible del HUD. | Pendiente de ejecución manual en un navegador (véase registro). |
| PM-02 | **Cambio de tema.** Desde Ajustes, seleccionar un tema distinto; navegar entre Inicio, Tienda y Perfil y recargar. | Se actualizan variables de color, clase de tema y selección visual; el tema persiste tras recargar y no afecta el saldo, inventario ni racha. | Pendiente de ejecución manual en un navegador (véase registro). |
| PM-03 | **Claim diario: continuidad, reinicio y reparación.** Preparar tres estados: último reclamo del día anterior (`diffDays = 1`), de hace más de dos días (`diffDays > 2`) y de hace dos días (`diffDays = 2`) con al menos 500 monedas. Pulsar `BONO DIARIO`; en el último caso confirmar el modal de reparación. | Con `diffDays = 1`, la racha aumenta en 1 y se abona `min(20 + (racha - 1) × 5, 60)`. Con `diffDays > 2`, la racha queda en 1 y se abonan 20 monedas. Con `diffDays = 2`, no se abona el bono antes de confirmar; la reparación conserva la racha, descuenta exactamente 500 monedas y actualiza el botón. Un segundo reclamo del mismo día informa que ya se reclamó. | Pendiente de ejecución manual en un navegador (véase registro). |
| PM-04 | **Promo: válido, duplicado e inválido.** Canjear un código válido autorizado para QA; repetirlo; probar una cadena no registrada. Registrar saldo e historial antes y después de cada intento. | El válido añade una única recompensa, queda en historial y persiste. El duplicado indica que ya se canjeó sin cambiar saldo. El inválido indica que es inválido sin cambiar saldo ni historial. | Pendiente de ejecución manual en un navegador (véase registro). |
| PM-05 | **Compra: oferta, saldo insuficiente y cashback.** Con un artículo no adquirido, probar una compra con saldo inferior al precio final; después, con saldo suficiente, comprarlo con la oferta vigente y cashback configurado. | El intento sin saldo falla sin mutar inventario ni saldo. La compra válida usa el precio con oferta, aplica el cashback configurado, registra ambos movimientos cuando corresponda, marca el artículo como adquirido y persiste tras recargar. | Pendiente de ejecución manual en un navegador (véase registro). |
| PM-06 | **Bendición Lunar: compra y extensión.** Con al menos 100 monedas, activarla desde Tienda; anotar vencimiento. Volver a activarla antes de vencer o usar la extensión disponible para QA. | La activación descuenta 100 monedas, fija un vencimiento de siete días y la UI indica que está activa. Una activación mientras está vigente suma siete días desde el vencimiento anterior; la extensión válida suma sus días y deja registro sin alterar la racha. Un claim durante vigencia suma exactamente 90 monedas adicionales. | Pendiente de ejecución manual en un navegador (véase registro). |
| PM-07 | **Avatar local y cloud.** Sin sesión cloud, subir una imagen pequeña y recargar. Con sesión cloud de prueba, subir una imagen pequeña distinta y abrir de nuevo el perfil tras sincronización. | Sin sesión, el avatar comprimido se guarda localmente, se aplica en navbar/HUD/perfil y persiste. Con sesión, se intenta subir al bucket `avatars`, se conserva la URL pública cuando tiene éxito y se mantiene un fallback local controlado si falla; en ambos casos no se rompe el resto del perfil. | Pendiente de ejecución manual en un navegador (véase registro). |
| PM-08 | **Edición de identidad.** Cambiar nickname y género desde Perfil/Ajustes, navegar a otra vista y recargar. | El nombre y sufijo de género visibles se actualizan, persisten tras recargar y el resto del estado (avatar, saldo, tema y racha) permanece intacto. | Pendiente de ejecución manual en un navegador (véase registro). |
| PM-09 | **Exportación e importación de backup.** Generar un backup con saldo, inventario, racha e identidad conocidos; cambiar esos datos en el perfil de prueba; importar el backup generado. Probar también un payload con checksum alterado. | La exportación genera un código válido. La importación válida restaura el estado exportado y refresca UI; el payload alterado se rechaza sin modificar el estado existente. | Pendiente de ejecución manual en un navegador (véase registro). |
| PM-10 | **Login cloud y merge Last-Write-Wins.** En dos perfiles de navegador de prueba, crear estados locales con marcas temporales distintas, iniciar sesión en la misma cuenta y observar la sincronización/rehidratación. | El snapshot con `updated_at` más reciente gana según Last-Write-Wins; el estado aplicado actualiza UI y `localStorage` sin perder estructura ni provocar errores. Las modificaciones posteriores se sincronizan de nuevo. | Pendiente de ejecución manual en un navegador con Supabase de prueba (véase registro). |
| PM-11 | **Banner de actualización del Service Worker.** Con una versión instalada, desplegar/servir una revisión de prueba que instale un worker nuevo y volver a la pestaña controlada. Pulsar `Actualizar`. | Se muestra una sola vez el banner «Nueva versión disponible» cuando hay worker esperando. Al pulsarlo se envía `SKIP_WAITING`; tras `controllerchange` la página se recarga bajo la nueva versión. | Pendiente de ejecución manual en un navegador con flujo de SW de prueba (véase registro). |
| PM-12 | **Carga offline.** Cargar la aplicación una vez conectada y controlada por el Service Worker; poner DevTools en modo offline y recargar/navegar por las vistas del shell. | El shell precacheado carga sin red; no hay pantalla de error para los recursos cacheados y el estado local previamente guardado sigue disponible. Las funciones remotas pueden degradarse, pero no deben bloquear la navegación local. | Pendiente de ejecución manual en un navegador (véase registro). |

## Registro de ejecución de la línea base

| Campo | Valor |
| --- | --- |
| Fecha del intento | 2026-09-21 UTC |
| Commit de referencia | `bdfe19e` (`Create tickets-temporal.md`) |
| Entorno disponible | Shell no interactivo; Node.js `v24.15.0`; Python `3.14.4`. |
| Servidor previsto | `python3 -m http.server 8080` desde la raíz del repositorio. |
| Navegador automatizable | No disponible: no se encontró Chromium/Chrome en el entorno. |
| Intento de habilitar navegador | `npx --yes playwright --version` fue rechazado por la política de red con `npm error 403` al solicitar `playwright`. |
| Estado de PM-01 a PM-12 | **No ejecutados en este entorno**: requieren un navegador real y, para PM-10/PM-11, infraestructura externa de Supabase/Service Worker. Los resultados esperados anteriores quedan registrados como la referencia reproducible que debe confirmar un ejecutor con navegador antes de usarla como línea base aprobada. |

## Criterio de comparación posterior

Tras cada ticket de modularización, repetir únicamente los casos afectados y
comparar el resultado observable con esta tabla. Cualquier cambio en saldo,
racha, mensajes, persistencia, orden de render inicial, sincronización o
degradación offline se considera regresión hasta que exista un ticket aprobado
que modifique explícitamente ese comportamiento.
