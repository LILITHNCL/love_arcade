# Verificación Humana FASE 2c

Las siguientes comprobaciones no se pueden realizar de forma automatizada en este entorno y requieren ejecución manual en un entorno con navegador y conexión a internet.

## 1. Verificación del fallo en persistencia del caché de tiempo por Cuota de Almacenamiento
* **Objetivo:** Comprobar cómo reacciona el código real cuando el `localStorage` está lleno y falla el guardado del caché de tiempo de red en `_writeTimeCache`.
* **Pasos:**
  1. Abrir la consola de desarrollo del navegador.
  2. Ejecutar el siguiente script para llenar el localStorage:
     ```javascript
     try {
       for(let i=0; i<10000; i++) {
         localStorage.setItem('fill'+i, 'x'.repeat(100000));
       }
     } catch(e) {
       console.log("LocalStorage lleno");
     }
     ```
  3. Ejecutar `window.LoveArcadeTime.scheduleSync()` para forzar un sync.
  4. Revisar la pestaña de red para verificar que la petición HEAD sale y retorna un timestamp válido.
  5. Leer `window.LoveArcadeTime.read()`.
* **Resultado Esperado:** La petición de red debe resolverse con normalidad. Sin embargo, al guardar en caché debería tragar la excepción (try/catch silencioso en `_writeTimeCache`), por lo tanto `read()` no leerá el nuevo caché y posiblemente retornará el caché anterior o, si fue purgado el caché, `verified: false`. La app no debe romperse y el reclamo diario debe intentar funcionar según el valor fallback.

## 2. Trampa de racha mediante manipulación de reloj (viaje en el tiempo)
* **Objetivo:** Verificar el comportamiento descrito en BUG-F2c-01 (Sin caché de tiempo verificada, se permite reclamo con reloj local).
* **Pasos:**
  1. Accede a la app y reclama tu bono diario.
  2. Apaga tu conexión a internet o bloquea las peticiones en DevTools (Network -> Offline).
  3. Abre DevTools > Application > Local Storage, y borra la clave `love_arcade_time_cache`.
  4. Cambia la fecha de tu sistema operativo al día siguiente.
  5. Refresca la app y verifica si puedes reclamar de nuevo el bono diario.
* **Resultado Esperado:** Al no haber conectividad, no se puede reconstruir el caché. Al borrar el caché antiguo, `_readTimeCache` devuelve `verified: false`. Dado el error en la guarda de `claimDaily`, el reclamo usará el reloj local adelantado y te entregará el bono. **Esto confirmará el comportamiento de BUG-F2c-01**.
