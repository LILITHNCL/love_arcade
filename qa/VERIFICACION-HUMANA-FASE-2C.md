# Verificación Humana FASE 2c

Las siguientes comprobaciones no se pueden realizar de forma automatizada en este entorno y requieren ejecución manual en un entorno con navegador y conexión a internet.

## Qué no pude verificar en Termux
- El comportamiento real de los navegadores cuando lanzan excepciones de cuota de almacenamiento (`QuotaExceededError` o equivalentes como `NS_ERROR_DOM_QUOTA_REACHED`), dado que el entorno `vm` en Termux simula el LocalStorage en memoria y su capacidad es arbitraria y no sujeta a límites de sistema operativo/navegador.
- El comportamiento de la app ante cambios reales del reloj del sistema operativo (viajes en el tiempo) estando desconectado de internet, dado que aquí `Date.now()` está controlado por un reloj falso en las pruebas.

## 1. Verificación del fallo en persistencia del caché de tiempo por Cuota de Almacenamiento
* **Objetivo:** Comprobar cómo reacciona el código real cuando el `localStorage` está lleno y falla el guardado del caché de tiempo de red en `_writeTimeCache`.
* **Pasos:**
  1. **Importante:** Exportar un backup `.labak` antes de iniciar para no perder datos.
  2. Usar un perfil de navegador limpio (o incógnito) o un entorno local/origen sin partida real valiosa.
  3. Abrir la consola de desarrollo del navegador.
  4. Ejecutar el siguiente script para llenar el localStorage:
     ```javascript
     try {
       for(let i=0; i<10000; i++) {
         localStorage.setItem('fill'+i, 'x'.repeat(100000));
       }
     } catch(e) {
       console.log("LocalStorage lleno");
     }
     ```
  5. Ejecutar `window.LoveArcadeTime.scheduleSync()` para forzar un sync.
  6. Revisar la pestaña de red para verificar que la petición HEAD sale y retorna un timestamp válido.
  7. Leer en consola el valor de: `window.LoveArcadeTime.read()`.
  8. **Al terminar:** Limpiar las claves generadas ejecutando en consola:
     ```javascript
     Object.keys(localStorage).filter(k => k.startsWith('fill')).forEach(k => localStorage.removeItem(k));
     ```
* **Resultado Esperado:** La petición de red debe resolverse con normalidad. Sin embargo, al guardar en caché debería tragar la excepción (try/catch silencioso en `_writeTimeCache`), por lo tanto `read()` no leerá el nuevo caché y posiblemente retornará el caché anterior o, si fue purgado el caché, `verified: false`. La app no debe romperse y el reclamo diario debe intentar funcionar según el valor fallback.

## 2. Trampa de racha mediante manipulación de reloj (viaje en el tiempo)
* **Objetivo:** Verificar el comportamiento descrito en BUG-F2c-01 (Sin caché de tiempo verificada, se permite reclamo con reloj local).
* **Pasos:**
  1. Accede a la app y reclama tu bono diario.
  2. Apaga tu conexión a internet o bloquea las peticiones en DevTools (Network -> Offline).
  3. Abre DevTools > Application > Local Storage, y borra la clave `love_arcade_time_cache`.
  4. Cambia la fecha de tu sistema operativo al día siguiente.
  5. Refresca la app y verifica si puedes reclamar de nuevo el bono diario.
* **Resultado Esperado:** Al no haber conectividad, no se puede reconstruir el caché. Al borrar el caché antiguo, `window.LoveArcadeTime.read()` devuelve `verified: false`. Dado el error en la guarda de `claimDaily`, el reclamo usará el reloj local adelantado y te entregará el bono. **Esto confirmará el comportamiento de BUG-F2c-01**.
