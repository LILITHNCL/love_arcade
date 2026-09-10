/**
 * shop-logic.js — Love Arcade v9.9.2
 * ─────────────────────────────────────────────────────────────────────────────
 * Contiene toda la lógica de la vista Tienda, extraída del script inline de
 * shop.html como parte de la migración a arquitectura SPA.
 *
 * NOVEDADES v9.9.2 (Hardening & Error Detection):
 *  - handleRedeem(): único punto de disparo de track('redeem_code'). El call
 *    duplicado en app.js/redeemPromoCode() fue eliminado.
 *  - handleRedeem(): nuevo track('invalid_promo_code') en la rama failure cuando
 *    result.message === 'Código inválido'. Diferencia intentos de adivinar códigos
 *    de errores ya canjeados (message === 'Ya canjeaste este código'), que se
 *    ignoran para no saturar el canal.
 *    agregar un ítem (isNow === true), no al quitarlo.
 *  - loadCatalog(): añade track('user_snapshot') una sola vez por sesión de
 *    navegador (guardado en sessionStorage bajo 'ga_snapshot_sent') tras cargar
 *    el catálogo con éxito. Registra saldo, items comprados, items disponibles,
 *    racha y códigos canjeados. No se repite en navigations SPA ni retries.
 *  - handleExport(): nuevo track('sync_export') al exportar la partida.
 *    Permite medir cuántos usuarios usan la sincronización entre dispositivos.
 *
 * NOVEDADES v9.9.1 (Ghost Analytics — producción):
 *  - buy_item: GhostAnalytics.track() tras una compra exitosa.
 *    Registra nombre del wallpaper, precio final, cashback y categoría.
 *  - Los hooks anteriores (view_preview, click_download, redeem_code) se mantienen.
 *  - view_preview: GhostAnalytics.track() en openPreviewModal() inmediatamente
 *    tras modal.classList.remove('hidden') — fase síncrona, sin depender del rAF.
 *  - click_download: se emite desde el modal de Colección (fuente:"colección")
 *    y en el bloque isOwned de openPreviewModal() (fuente:"preview") sobre los
 *    <a download> generados dinámicamente.
 *  - redeem_code: GhostAnalytics.track() en handleRedeem() cuando result.success.
 *    El código original se ofusca con *** antes de enviarlo.
 *  - Todas las llamadas usan optional chaining (?.) para que el módulo sea
 *    no-operativo si analytics.js no está cargado.
 *
 * NOVEDADES v9.7 (Smart Preload — Fase 2 hardening):
 *  - _preloadItemHiRes(): añadido img.decoding = 'async'. La decodificación de
 *    píxeles ya no bloquea el hilo principal cuando múltiples precargas resuelven
 *    simultáneamente durante scroll rápido. Soporte universal: Chrome 65+,
 *    Firefox 63+, Safari 11.1+.
 *  - openPreviewModal(): thumbProbe e hiRes también reciben decoding = 'async'.
 *    La imagen hi-res (hasta 1200 px) se decodifica en el thread del compositor;
 *    el swap de backgroundImage ya no provoca jank en la animación del modal.
 *  - Nuevo helper _isDataSaverActive(): omite la precarga si el usuario tiene
 *    Data Saver activo (navigator.connection.saveData) o la conexión es slow-2g.
 *    Respeta la preferencia explícita del usuario sin degradar la funcionalidad
 *    (el modal carga la imagen cuando se abre, como antes de v9.6).
 *  - Nuevo helper _isLowBandwidth(): detecta conexión 2g y reduce el lote de
 *    precarga a 2 imágenes por ciclo.
 *  - Nuevo scheduler de precarga (_preloadQueue, _schedulePreloadItem,
 *    _schedulePreloadFlush, _flushPreloadQueue): agrupa las entries del mismo
 *    ciclo del observer en un requestIdleCallback (fallback: setTimeout) para
 *    no saturar la red durante ráfagas de scroll. El scheduler se cancela y
 *    la cola se vacía en _initPreloadObserver() al reconstruirse el DOM.
 *  - _initPreloadObserver(): rootMargin cambiado a '200px 0px 400px 0px'
 *    (superior 200 px para scroll hacia arriba, inferior 400 px para zona de
 *    precarga principal, sin margen horizontal). threshold cambiado de 0.1 a 0
 *    para disparar en cuanto cualquier píxel del card entra en la zona extendida,
 *    maximizando el tiempo de anticipación sin esperar el 10 % de visibilidad.
 *
 * NOVEDADES v9.5 (Cloudinary CDN Migration):
 *  - assets/product-thumbs/ ELIMINADA. Las thumbnails del catálogo se cargan
 *    desde Cloudinary con la transformación ar_16:9,c_fill,g_auto,w_640.
 *    El campo `image` de shop.json ahora apunta directamente a la URL CDN.
 *  - assets/cover/ ELIMINADA. Las carátulas de los juegos en index.html
 *    usan Cloudinary con la transformación ar_16:9,c_fill,g_auto,w_1080.
 *  - getDownloadUrl() en app.js: la URL de descarga/email usa la estructura
 *    limpia https://res.cloudinary.com/dyspgn0sw/image/upload/{public_id}
 *    sin extensión ni parámetros de transformación, sirviendo el master original.
 *
 * NOVEDADES v9.4 (sincronización de versión con app.js):
 *  - Eliminado will-change estático en tarjetas del catálogo y Colección.
 *    El GPU-layer management ahora vive exclusivamente en CSS (hover :hover).
 *  - handleExport() refactorizado para usar window.MailHelper.copyToClipboard()
 *    en lugar de reimplementar el patrón navigator.clipboard + execCommand.
 *  - _noCtxHandler movido a variable de cierre del módulo (ya no muta el DOM).
 *  - [v9.6] lucide.createIcons() eliminado. Iconos servidos como SVG Sprite estático.
 *
 * NOVEDADES v9.1:
 *  - loadCatalog(): función encapsulada con manejo de errores y reintento.
 *    Si fetch falla, muestra #shop-error-state con botón #btn-retry-shop.
 *  - El listener de .theme-btn fue eliminado de shop-logic.js (corrección
 *    aplicada en la limpieza SPA). El único registro vive en app.js vía
 *    setTheme(), que actualiza store, CSS vars, clase en <body> y el estado
 *    visual de todos los .theme-btn desde un único lugar.
 *  - El listener de #btn-moon-blessing vive exclusivamente aquí; el duplicado
 *    en app.js fue eliminado (corrección SPA) para evitar el cobro doble.
 *
 * DEPENDENCIAS (deben estar cargadas ANTES en el DOM):
 *  - js/app.js          → window.GameCenter, window.ECONOMY, window.debounce, window.MailHelper
 *  - [v9.6] lucide eliminado. _icon() helper genera referencias al SVG Sprite.
 *  - canvas-confetti    → lazy-load on demand (no bloquea ruta crítica)
 *
 * OPTIMIZACIONES DE RENDIMIENTO:
 *  - fetch('data/shop.json') se ejecuta UNA SOLA VEZ en DOMContentLoaded y
 *    precarga el catálogo completo en memoria (variable allItems).
 *  - La búsqueda usa window.debounce() para evitar sobrecargar el hilo principal.
 *  - Los toasts usan .remove() tras su animación de salida (limpieza del DOM).
 *  - El confetti solo se dispara cuando la pestaña está activa (document.hidden check).
 *  - will-change en tarjetas: gestionado en CSS vía :hover, no en JS. Esto evita
 *    promover N capas GPU simultáneas cuando el catálogo está estático.
 *  - [v9.6] lucide.createIcons() eliminado — sin escaneo dinámico del DOM.
 *    parciales para evitar el scan del DOM completo.
 *
 * NOTAS SPA:
 *  - Todos los event listeners se registran una sola vez en DOMContentLoaded.
 *  - window.ShopView.onEnter() es llamado por spa-router.js al entrar a la vista
 *    de Tienda, permitiendo refrescar estado sin re-inicializar todo.
 */

// ── Estado del catálogo (módulo privado) ──────────────────────────────────────
let allItems     = [];
let activeShopView = 'shop';
let _collectionMounted = false;
let _collectionSearchQuery = '';
let _collectionSearchFrame = null;
let _collectionSearchIndex = new Map();
let _catalogRevision = 0;
let _shopScrollFrame = null;
let _lastShopScrollY = 0;
let _shopDelegationBound = false;
let _shopLazyObserver = null;
let _shopLazySentinel = null;
const _shopReducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
const _shopCoarsePointerMql = window.matchMedia('(pointer: coarse)');
let _shopPrefersReducedMotion = _shopReducedMotionMql.matches;
let _shopCoarsePointer = _shopCoarsePointerMql.matches;
const _bindMqlChange = (mql, handler) => {
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', handler);
    else if (typeof mql.addListener === 'function') mql.addListener(handler);
};
_bindMqlChange(_shopReducedMotionMql, (e) => { _shopPrefersReducedMotion = e.matches; });
_bindMqlChange(_shopCoarsePointerMql, (e) => { _shopCoarsePointer = e.matches; });
/**
 * Estado de renderizado incremental del catálogo.
 * En lugar de pintar todos los ítems de una sola vez (costoso con catálogos
 * grandes), se montan en lotes bajo demanda al acercarse al final del grid.
 */
const _shopRenderState = {
    items: [],
    cursor: 0,
    batchSize: 18,
    rails: [],
    thumbnailWidth: 640
};

// ── Último elemento con foco antes de abrir un modal ─────────────────────────
// Se guarda en openXxxModal() y se restaura en _closeXxxModal() para que los
// usuarios de teclado no pierdan su posición en el flujo de la interfaz (WCAG 2.4.3).
let _lastFocusedElement = null;
let isRedeeming = false;

/**
 * Helper: genera el markup de un icono SVG Sprite.
 * Reemplaza el patrón <svg class="icon" aria-hidden="true"><use href="#icon-NAME"></use></svg> eliminado en v9.6.
 *
 * @param {string} name      - Nombre del icono (ej: "download", "heart").
 * @param {number} [size=16] - Ancho y alto en px.
 * @param {Object} [opts]    - Opciones adicionales.
 * @param {string} [opts.fill]   - Valor CSS para fill (ej: "#fbbf24", "currentColor").
 * @param {string} [opts.stroke] - Valor CSS para stroke (ej: "none").
 * @param {string} [opts.cls]    - Clases CSS adicionales.
 * @returns {string} Markup SVG listo para insertar en innerHTML.
 */
function _icon(name, size = 16, opts = {}) {
    const w = size;
    const styleArr = [];
    if (opts.fill !== undefined)   styleArr.push(`fill:${opts.fill}`);
    if (opts.stroke !== undefined) styleArr.push(`stroke:${opts.stroke}`);
    const style = styleArr.length ? ` style="${styleArr.join(';')}"` : '';
    const cls   = opts.cls ? `icon ${opts.cls}` : 'icon';
    return `<svg class="${cls}" width="${w}" height="${w}"${style} aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
let _modalResolve = null;

function openConfirmModal({ title, bodyHTML, confirmText = 'Confirmar' }) {
    document.getElementById('modal-title').textContent   = title;
    document.getElementById('modal-body').innerHTML      = bodyHTML;
    document.getElementById('modal-confirm').textContent = confirmText;
    document.getElementById('modal-error').textContent   = '';
    // Guardar el elemento con foco activo para restaurarlo al cerrar (WCAG 2.4.3).
    _lastFocusedElement = document.activeElement;
    const overlay = document.getElementById('confirm-modal');
    overlay.classList.remove('hidden');
    window.ModalA11y?.open?.(overlay, _lastFocusedElement);
    requestAnimationFrame(() => document.getElementById('modal-confirm').focus());
    return new Promise(resolve => { _modalResolve = resolve; });
}

function _closeModal(value) {
    const confirmModal = document.getElementById('confirm-modal');
    confirmModal.classList.add('hidden');
    window.ModalA11y?.close?.(confirmModal);
    if (_modalResolve) { _modalResolve(value); _modalResolve = null; }
    // Restaurar foco al elemento que abrió el modal para no desorientar al usuario
    // de teclado (WCAG 2.4.3 — Focus Order).
    _lastFocusedElement?.focus();
    _lastFocusedElement = null;
}

// ── Preview image helpers ────────────────────────────────────────────────────
/**
 * Deriva una miniatura Cloudinary sin modificar la URL fuente guardada en el
 * catálogo. Las URLs que no siguen el formato esperado siguen funcionando tal
 * cual, para no convertir un problema de datos en una tarjeta rota.
 */
function getThumbnailUrl(sourceUrl, aspectRatio, width) {
    if (typeof sourceUrl !== 'string') return sourceUrl;
    const uploadMarker = '/image/upload/';
    if (!sourceUrl.includes(uploadMarker)) {
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            console.warn('[Shop] La imagen no tiene el formato Cloudinary esperado:', sourceUrl);
        }
        return sourceUrl;
    }

    const ratio = aspectRatio === '9:16' ? '9:16' : '3:4';
    const safeWidth = Math.max(160, Math.min(1600, Math.round(Number(width) || 640)));
    const transforms = `f_auto,q_auto,c_fill,g_auto,ar_${ratio},w_${safeWidth}`;
    return sourceUrl.replace(uploadMarker, `${uploadMarker}${transforms}/`);
}

/** Deriva una descarga de Cloudinary sin exponer el recurso maestro inline. */
function getImageDownloadUrl(sourceUrl) {
    if (typeof sourceUrl !== 'string') return null;
    const uploadMarker = '/image/upload/';
    if (!sourceUrl.includes(uploadMarker)) {
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            console.warn('[Shop] La descarga no tiene el formato Cloudinary esperado:', sourceUrl);
        }
        return sourceUrl;
    }
    return sourceUrl.replace(uploadMarker, `${uploadMarker}fl_attachment/`);
}

/** Resuelve una descarga solo para artículos que siguen en el inventario. */
function resolveOwnedDownloadUrl(item) {
    if (!item || GameCenter.getBoughtCount(item.id) <= 0) return null;
    const sourceUrl = item.type === 'file' ? item.downloadUrl : getImageDownloadUrl(item.imageUrl);
    return GameCenter.getDownloadUrl(item.id, sourceUrl);
}

function triggerDownload(url) {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    // Cloudinary usa fl_attachment y los archivos usan su URL de descarga
    // directa; download conserva la intención también en orígenes compatibles.
    link.download = '';
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
}

// ── Smart Preload — Intersection Observer (v9.7) ──────────────────────────────

// ── Connection helpers ────────────────────────────────────────────────────────

/**
 * Devuelve true si el usuario activó Data Saver o la conexión es extremadamente
 * lenta (slow-2g). En ese caso la precarga se omite por completo para respetar
 * la preferencia explícita del usuario y no consumir su ancho de banda limitado.
 *
 * La Network Information API es opcional. Si el navegador no la soporta
 * (Firefox, Safari < 17.4) la función devuelve false y la precarga procede con
 * normalidad — degradación elegante sin comportamiento diferencial.
 *
 * @returns {boolean}
 */
function _isDataSaverActive() {
    const conn = navigator?.connection;
    if (!conn) return false;
    return conn.saveData === true || conn.effectiveType === 'slow-2g';
}

/**
 * Devuelve true si la conexión es lenta pero funcional (~2G / 100–250 kbps).
 * En ese caso la precarga no se cancela, pero el lote de despacho se limita
 * a 2 imágenes por ciclo para no monopolizar el ancho de banda disponible.
 *
 * @returns {boolean}
 */
function _isLowBandwidth() {
    return navigator?.connection?.effectiveType === '2g';
}

// ── Preload scheduler — cola y despacho por lotes ─────────────────────────────
//
// Problema: cuando el usuario hace scroll rápido y varias tarjetas entran en
// el viewport al mismo tiempo, el observer recibe todas sus entries de golpe.
// Sin throttling, se inician N descargas simultáneas que compiten entre sí,
// saturando el ancho de banda aunque fetchPriority='low' esté activo.
//
// Solución: encolar todas las solicitudes del mismo ciclo del observer y
// despacharlas en requestIdleCallback (fallback: setTimeout) una vez que el
// hilo principal está libre. En conexión 2g, el lote se limita a 2 items para
// no consumir toda la red disponible. Los items restantes se procesan en el
// siguiente ciclo idle.
//
// El scheduler se cancela y la cola se vacía en _initPreloadObserver() cada
// vez que renderShop() reconstruye el DOM, evitando referencias colgadas.

/** @type {Array<{cardEl: HTMLElement, item: object}>} */
const _preloadQueue = [];

/** @type {number|null} Handle del requestIdleCallback o setTimeout activo. */
let _preloadFlushId = null;

/**
 * Despacha el lote de precargas pendiente.
 * Limita el tamaño del lote a 2 en conexión 2g; en conexión normal procesa
 * toda la cola de una vez. Si quedan items, agenda el siguiente ciclo idle.
 */
function _flushPreloadQueue() {
    _preloadFlushId = null;
    // Lote acotado para evitar tareas largas en requestIdleCallback durante
    // scroll rápido con catálogos grandes (+70 ítems).
    const batchSize = _isLowBandwidth() ? 2 : 4;
    _preloadQueue.splice(0, batchSize).forEach(({ cardEl, item }) =>
        _preloadItemHiRes(cardEl, item)
    );
    // Continuar procesando si quedan items pendientes
    if (_preloadQueue.length > 0) _schedulePreloadFlush();
}

/**
 * Agenda _flushPreloadQueue en el próximo tiempo de inactividad del hilo
 * principal. Usa requestIdleCallback cuando está disponible (Chrome, Edge,
 * Opera) con un timeout de seguridad que garantiza ejecución incluso durante
 * scroll continuo prolongado. Fallback a setTimeout para Firefox y Safari.
 */
function _schedulePreloadFlush() {
    if (_preloadFlushId !== null) return; // Ya hay un despacho programado
    if ('requestIdleCallback' in window) {
        // timeout = tiempo máximo de espera antes de forzar la ejecución.
        // Más largo en 2g para ceder la red a la navegación activa.
        _preloadFlushId = requestIdleCallback(_flushPreloadQueue, {
            timeout: _isLowBandwidth() ? 1200 : 200
        });
    } else {
        _preloadFlushId = setTimeout(
            _flushPreloadQueue,
            _isLowBandwidth() ? 400 : 0
        );
    }
}

/**
 * Añade un item a la cola de precarga y dispara el scheduler si aún no está
 * activo. Llamada por el callback del IntersectionObserver.
 *
 * @param {HTMLElement} cardEl
 * @param {object}      item
 */
function _schedulePreloadItem(cardEl, item) {
    _preloadQueue.push({ cardEl, item });
    _schedulePreloadFlush();
}

/**
 * Precarga silenciosa de la imagen hi-res de un item en background.
 *
 * El navegador almacena la imagen en su caché HTTP (disco/memoria). Cuando
 * openPreviewModal() crea su propio Image() con la misma URL, el navegador
 * resuelve la petición desde la caché sin tocar la red → latencia ~0 ms.
 *
 * NOVEDADES v9.7:
 *  - img.decoding = 'async': la decodificación de la imagen se encola en el
 *    hilo de decodificación del navegador sin bloquear el hilo principal ni
 *    un milisegundo. Crítico cuando el observer activa 8-10 precargas al mismo
 *    tiempo durante un scroll rápido: sin este atributo, cada new Image() que
 *    resuelve dispara la decodificación síncronamente y puede congelar el hilo
 *    principal por 10-40 ms por imagen dependiendo de la GPU del dispositivo.
 *
 * Marca el card con data-preloaded="true" una vez iniciada la carga para que
 * el observer no vuelva a disparar trabajo redundante en el mismo elemento.
 *
 * @param {HTMLElement} cardEl  — Elemento .shop-card que entró en el viewport.
 * @param {object}      item    — Objeto item completo de allItems[].
 */
function _preloadItemHiRes(cardEl, item) {
    // Evitar doble precarga si la tarjeta ya fue procesada
    if (cardEl.dataset.preloaded) return;
    // Marcar ANTES de crear la Image() para evitar condición de carrera si el
    // observer dispara dos veces rápidamente en el mismo frame
    cardEl.dataset.preloaded = 'true';

    const url = getThumbnailUrl(item.imageUrl, cardEl.dataset.aspectRatio, cardEl.dataset.thumbnailWidth);
    const img = new Image();

    // fetchPriority='low': no compite con recursos críticos del HUD/UI.
    // Soportado en Chrome 101+ y Safari 17.2+; ignorado silenciosamente en otros.
    img.fetchPriority = 'low';

    // decoding='async': la decodificación de píxeles se realiza fuera del
    // hilo principal (thread del compositor/GPU). Evita micro-congelaciones
    // durante scroll rápido cuando múltiples precargas resuelven al mismo tiempo.
    // Soporte: Chrome 65+, Firefox 63+, Safari 11.1+ — cobertura universal.
    img.decoding = 'async';

    img.onload  = () => { /* imagen ya en caché — modal abrirá instantáneamente */ };
    img.onerror = () => {
        // CDN inalcanzable: resetear para que openPreviewModal use su fallback CSS.
        delete cardEl.dataset.preloaded;
    };
    img.src = url;
}

/**
 * Crea el IntersectionObserver de precarga para el catálogo actual.
 *
 * CONFIGURACIÓN v9.7:
 *  - rootMargin: '200px 0px 400px 0px'
 *      · Superior 200 px: anticipa el scroll hacia arriba.
 *      · Inferior 400 px: zona de precarga principal (~2 alturas de card).
 *        Con una conexión 4G promedio (5-10 MB/s) y una imagen optimizada
 *        en Cloudinary de ~80-150 KB, 400 px de margen equivalen a ~1.5 s
 *        de scroll tranquilo — suficiente para que la imagen esté en caché
 *        cuando el usuario llegue a la tarjeta.
 *      · Lados 0 px: sin margen horizontal. El catálogo es vertical; extender
 *        lateralmente activaría precargas en cards con overflow oculto.
 *  - threshold: 0
 *      Con rootMargin ya proveyendo el buffer, threshold: 0.1 añadía latencia
 *      extra (debía verse un 10 % del card dentro de la zona expandida antes
 *      de disparar). Con threshold: 0 el observer dispara en cuanto cualquier
 *      píxel del card entra en la zona, maximizando el tiempo de anticipación.
 *
 * GUARD DE CONEXIÓN (v9.7):
 *  - Si el usuario tiene Data Saver activo o conexión slow-2g, la función
 *    retorna sin crear el observer. La imagen se cargará al abrir el modal,
 *    que es el comportamiento pre-v9.6 — sin degradación funcional.
 *  - En conexión 2g (lenta pero funcional), el observer se crea normalmente
 *    pero el scheduler limita el lote a 2 imágenes por ciclo.
 *
 * SCHEDULER (v9.7):
 *  Usa _schedulePreloadItem() en lugar de _preloadItemHiRes() directamente
 *  para que múltiples entries del mismo ciclo del observer se encolen y se
 *  despachen en un requestIdleCallback, sin bloquear el hilo principal durante
 *  ráfagas de scroll.
 *
 * El mapa abarca todo el catálogo filtrado, por lo que el mismo observer puede
 * resolver tanto las tarjetas iniciales como los lotes que se añaden al hacer
 * scroll. La observación de esos lotes se delega a _observeNewShopCards().
 *
 * @param {object[]} items — Arreglo completo de items del render actual.
 * @returns {IntersectionObserver|null}
 */
function _createPreloadObserver(items) {
    // Degradación elegante: entornos sin soporte (browsers muy antiguos, SSR)
    if (!('IntersectionObserver' in window)) return null;

    // Respetar preferencia de ahorro de datos del usuario.
    // En slow-2g o Data Saver, cualquier precarga consumiría recursos que el
    // usuario explícitamente quiere conservar.
    if (_isDataSaverActive()) return null;

    // Construir mapa id → item para O(1) lookup en el callback. Debe incluir
    // el catálogo completo, no solo el primer lote, porque el observer persiste
    // durante los append incrementales.
    const itemMap = new Map(items.map(it => [it.id, it]));

    return new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const cardEl = entry.target;

            // Si ya fue procesado en un ciclo anterior, solo dejar de observar
            if (cardEl.dataset.preloaded) {
                _preloadObserver?.unobserve(cardEl);
                return;
            }

            // Resolver el item desde el control interactivo de la tarjeta visual.
            const cardButton = cardEl.querySelector('.shop-visual-card');
            const rawId      = cardButton?.dataset?.itemId;
            const item       = rawId ? itemMap.get(parseInt(rawId, 10)) : null;

            if (item) {
                // Usar el scheduler para agrupar entries del mismo ciclo en un
                // único lote idle, evitando N descargas simultáneas en scroll rápido
                _schedulePreloadItem(cardEl, item);
            }

            // Dejar de observar — ya no hay trabajo pendiente en este elemento
            _preloadObserver?.unobserve(cardEl);
        });
    }, {
        // Superior 200 px (scroll hacia arriba) · Inferior 400 px (scroll principal)
        // Sin margen horizontal para no activar cards fuera del flujo vertical
        rootMargin: '200px 0px 400px 0px',
        // threshold: 0 — disparar en cuanto cualquier píxel del card entra en la
        // zona extendida. Con rootMargin ya proveyendo el buffer, esperar al 10 %
        // solo añadía latencia sin beneficio de precisión.
        threshold:  0
    });
}

/**
 * Observa únicamente las tarjetas creadas por el lote incremental más reciente.
 * El observer se crea una vez por render completo mediante _initPreloadObserver;
 * si no existe, Data Saver o la falta de soporte ya desactivaron la precarga.
 *
 * @param {HTMLElement[]} cardEls — Tarjetas recién insertadas en el DOM.
 */
function _observeNewShopCards(cardEls) {
    if (!_preloadObserver) return;

    cardEls.forEach(card => {
        if (!card.dataset.preloaded && card.querySelector('.shop-visual-card')) {
            _preloadObserver.observe(card);
        }
    });
}

/**
 * Reinicia la precarga después de un render completo del catálogo.
 *
 * Idempotente: si _preloadObserver ya existe la desconecta y cancela la cola
 * pendiente antes de crear una nueva. Solo se invoca cuando renderShop() vacía
 * el grid; los lotes incrementales conservan este observer.
 *
 * @param {HTMLElement} container — #shop-container con las tarjetas ya en el DOM.
 * @param {object[]}    items     — Arreglo completo de items del render actual.
 */
function _initPreloadObserver(container, items) {
    // Desconectar observer anterior y vaciar la cola si el catálogo se re-renderizó.
    // Esto evita que callbacks pendientes referencien nodos del DOM anterior.
    if (_preloadObserver) {
        _preloadObserver.disconnect();
        _preloadObserver = null;
    }
    _preloadQueue.length = 0;
    if (_preloadFlushId !== null) {
        'cancelIdleCallback' in window
            ? cancelIdleCallback(_preloadFlushId)
            : clearTimeout(_preloadFlushId);
        _preloadFlushId = null;
    }

    _preloadObserver = _createPreloadObserver(items);
    if (!_preloadObserver) return;

    container.querySelectorAll('.shop-card').forEach(card => {
        _observeNewShopCards([card]);
    });
}

function _resolvePreviewItem(itemOrId) {
    if (itemOrId && typeof itemOrId === 'object') return itemOrId;
    return allItems.find(item => item.id === Number(itemOrId));
}

function _makePreviewButton(className, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
}

function _renderPreview(item) {
    const content = document.getElementById('preview-content');
    const status = document.getElementById('preview-status');
    if (!content || !status) return;
    content.replaceChildren();
    status.textContent = '';

    const image = document.createElement('img');
    image.className = 'preview-image';
    image.src = getThumbnailUrl(item.imageUrl, _getCardAspectRatio(allItems.indexOf(item)), 1200);
    image.alt = item.name;
    image.decoding = 'async';
    content.append(image);

    const title = document.createElement('h3');
    title.id = 'preview-title';
    title.className = 'preview-name';
    title.textContent = item.name;
    content.append(title);

    const actions = document.createElement('div');
    actions.className = 'preview-actions';
    const back = _makePreviewButton('btn-ghost', 'Volver');
    back.addEventListener('click', closePreviewModal);
    actions.append(back);

    const acquire = _makePreviewButton('btn-primary', 'Adquirir');
    acquire.addEventListener('click', () => _renderPurchaseConfirmation(item));
    actions.append(acquire);
    content.append(actions);
    requestAnimationFrame(() => back.focus());
}

function _renderCollectionItemModal(item) {
    const content = document.getElementById('preview-content');
    const status = document.getElementById('preview-status');
    const downloadUrl = resolveOwnedDownloadUrl(item);
    if (!content || !status || !downloadUrl) {
        closePreviewModal();
        return;
    }
    content.replaceChildren();
    status.textContent = '';

    const image = document.createElement('img');
    image.className = 'preview-image';
    image.src = getThumbnailUrl(item.imageUrl, _getCardAspectRatio(allItems.indexOf(item)), 1200);
    image.alt = item.name;
    image.decoding = 'async';

    const title = document.createElement('h3');
    title.id = 'preview-title';
    title.className = 'preview-name';
    title.textContent = item.name;

    const actions = document.createElement('div');
    actions.className = 'preview-actions';
    const close = _makePreviewButton('btn-ghost', 'Volver');
    close.addEventListener('click', closePreviewModal);
    const email = _makePreviewButton('btn-ghost', 'Enviar por correo');
    email.addEventListener('click', () => {
        closePreviewModal();
        openEmailModal(item, downloadUrl);
    });
    const download = _makePreviewButton('btn-primary', 'Descargar');
    download.addEventListener('click', () => {
        triggerDownload(downloadUrl);
        window.GhostAnalytics?.track('click_download', {
            wallpaper: item.name,
            categoría: item.category,
            fuente: 'colección'
        });
    });
    actions.append(close, email, download);
    content.append(image, title, actions);
    requestAnimationFrame(() => download.focus());
}

function openCollectionItemModal(itemOrId) {
    const item = _resolvePreviewItem(itemOrId);
    const modal = document.getElementById('preview-modal');
    if (!item || !modal || GameCenter.getBoughtCount(item.id) <= 0) return;
    _lastFocusedElement = document.activeElement;
    modal.classList.remove('hidden');
    window.ModalA11y?.open?.(modal, _lastFocusedElement, { onEscape: closePreviewModal });
    _renderCollectionItemModal(item);
}

function _renderPurchaseConfirmation(item) {
    const content = document.getElementById('preview-content');
    const status = document.getElementById('preview-status');
    if (!content || !status) return;
    const eco = window.ECONOMY;
    const finalPrice = eco.isSaleActive ? Math.floor(item.price * eco.saleMultiplier) : item.price;
    const cashback = Math.floor(finalPrice * eco.cashbackRate);
    content.replaceChildren();
    status.textContent = '';

    const title = document.createElement('h3');
    title.id = 'preview-title';
    title.className = 'modal-title preview-confirmation-title';
    title.textContent = '¿Adquirir regalo?';
    content.append(title);

    const details = document.createElement('dl');
    details.className = 'purchase-breakdown';
    const addRow = (label, value, className = '') => {
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        if (className) description.className = className;
        details.append(term, description);
    };
    addRow('Precio original', `${item.price} ⭐`);
    if (eco.isSaleActive) addRow('Descuento', `-${item.price - finalPrice} ⭐`, 'modal-value--sale');
    if (cashback > 0) addRow('Cashback', `+${cashback} ⭐`, 'modal-value--cashback');
    addRow('Total', `${finalPrice} ⭐`, 'purchase-breakdown-total');
    content.append(details);

    const actions = document.createElement('div');
    actions.className = 'preview-actions';
    const back = _makePreviewButton('btn-ghost', 'Volver');
    back.addEventListener('click', () => _renderPreview(item));
    const confirm = _makePreviewButton('btn-primary', `Adquirir · ${finalPrice} ⭐`);
    confirm.addEventListener('click', () => _completePreviewPurchase(item, confirm, back));
    actions.append(back, confirm);
    content.append(actions);
    requestAnimationFrame(() => confirm.focus());
}

async function _completePreviewPurchase(item, confirm, back) {
    const modal = document.getElementById('preview-modal');
    const status = document.getElementById('preview-status');
    confirm.disabled = true;
    back.disabled = true;
    modal?.setAttribute('aria-busy', 'true');
    confirm.textContent = 'Adquiriendo…';
    status.textContent = '';
    await new Promise(resolve => requestAnimationFrame(resolve));

    const result = GameCenter.buyItem(item);
    modal?.removeAttribute('aria-busy');
    if (!result.success) {
        confirm.disabled = false;
        back.disabled = false;
        confirm.textContent = `Adquirir · ${window.ECONOMY.isSaleActive ? Math.floor(item.price * window.ECONOMY.saleMultiplier) : item.price} ⭐`;
        status.textContent = result.reason === 'coins' ? 'No tienes suficientes monedas.' : 'No fue posible completar la adquisición.';
        confirm.focus();
        return;
    }

    const scrollY = window.scrollY;
    renderShopView();
    if (_collectionMounted) renderCollectionView();
    const balance = GameCenter.getBalance();
    document.querySelectorAll('.navbar .coin-display').forEach(el => {
        el.textContent = window.formatCoinsNavbar?.(balance) ?? balance;
        el.closest('.coin-badge')?.setAttribute('title', `${balance} monedas`);
    });
    document.querySelectorAll('.coin-display:not(.navbar .coin-display)').forEach(el => { el.textContent = balance; });
    _scheduleConfetti('purchase');
    window.GhostAnalytics?.track('buy_item', {
        wallpaper: item.name,
        precio: `${result.finalPrice} ⭐`,
        cashback: result.cashback > 0 ? `+${result.cashback} ⭐` : 'ninguno',
        categoría: item.category,
        saldo_tras: balance
    });
    status.textContent = `${item.name} desbloqueado.`;
    showToast(`"${item.name}" desbloqueado.`, 'success');
    closePreviewModal();
    requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'auto' }));
}

function openPreviewModal(itemOrId) {
    const item = _resolvePreviewItem(itemOrId);
    const modal = document.getElementById('preview-modal');
    if (!item || !modal) return;
    _lastFocusedElement = document.activeElement;
    modal.classList.remove('hidden');
    window.ModalA11y?.open?.(modal, _lastFocusedElement, { onEscape: closePreviewModal });
    window.GhostAnalytics?.track('view_preview', { wallpaper: item.name, categoría: item.category });
    _renderPreview(item);
}

function closePreviewModal() {
    const modal = document.getElementById('preview-modal');
    if (modal?.classList.contains('hidden') || modal?.getAttribute('aria-busy') === 'true') return;
    modal.classList.add('hidden');
    modal.removeAttribute('aria-busy');
    window.ModalA11y?.close?.(modal);
    _lastFocusedElement?.focus();
    _lastFocusedElement = null;
}

// ── Global exposure ───────────────────────────────────────────────────────────
// Required for:
//   (a) onclick="openPreviewModal(...)" in dynamically generated HTML strings
//   (b) onclick="closePreviewModal()" in modal action buttons
//   (c) any game module or external script calling the preview API
window.openPreviewModal  = openPreviewModal;
window.closePreviewModal = closePreviewModal;

// ── Vistas explícitas de Tienda y Colección ──────────────────────────────
function _ownedItems() {
    return allItems.filter(item => GameCenter.getBoughtCount(item.id) > 0);
}

function renderShopView() {
    const available = allItems.filter(item => GameCenter.getBoughtCount(item.id) === 0);
    const gridEl = document.getElementById('shop-container');
    const emptyEl = document.getElementById('shop-empty-state');
    renderShop(available);
    gridEl?.classList.toggle('hidden', available.length === 0);
    emptyEl?.classList.toggle('hidden', available.length !== 0);
}

function renderCollectionView() {
    if (!_collectionMounted) return;
    const query = _collectionSearchQuery;
    const owned = _ownedItems().filter(item => {
        const normalizedName = _collectionSearchIndex.get(item.id) || '';
        return !query || normalizedName.includes(query);
    });
    renderCollection(owned, Boolean(query));
}

function _mountCollection() {
    if (_collectionMounted) return;
    const section = document.getElementById('shop-collection');
    if (!section) return;
    section.replaceChildren();

    const heading = document.createElement('div');
    heading.className = 'section-header collection-header';
    const title = document.createElement('h2');
    title.className = 'section-title';
    title.textContent = 'Colección';
    const subtitle = document.createElement('p');
    subtitle.className = 'section-subtitle';
    subtitle.textContent = 'Tus artículos desbloqueados.';
    heading.append(title, subtitle);

    const searchWrap = document.createElement('div');
    searchWrap.className = 'collection-search-wrap';
    const label = document.createElement('label');
    label.className = 'visually-hidden';
    label.htmlFor = 'collection-search-input';
    label.textContent = 'Buscar en tu colección';
    const input = document.createElement('input');
    input.id = 'collection-search-input';
    input.className = 'collection-search-input';
    input.type = 'search';
    input.placeholder = 'Buscar en tu colección…';
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
        _collectionSearchQuery = input.value.trim().toLocaleLowerCase();
        if (_collectionSearchFrame !== null) cancelAnimationFrame(_collectionSearchFrame);
        _collectionSearchFrame = requestAnimationFrame(() => {
            _collectionSearchFrame = null;
            renderCollectionView();
        });
    });
    searchWrap.append(label, input);

    const grid = document.createElement('div');
    grid.id = 'collection-container';
    grid.className = 'shop-grid';
    grid.addEventListener('click', (event) => {
        const card = event.target.closest('.shop-visual-card');
        const item = allItems.find(candidate => candidate.id === Number(card?.dataset.itemId));
        if (item) openCollectionItemModal(item);
    });
    section.append(heading, searchWrap, grid);
    _collectionSearchIndex = new Map(allItems.map(item => [item.id, item.name.toLocaleLowerCase()]));
    _collectionMounted = true;
}

function switchShopView(view) {
    activeShopView = view;
    const shopPanel = document.getElementById('shop-catalog');
    const collectionPanel = document.getElementById('shop-collection');
    const toggle = document.getElementById('btn-toggle-collection');
    const showingCollection = view === 'collection';

    if (showingCollection) _mountCollection();
    shopPanel?.classList.toggle('hidden', showingCollection);
    collectionPanel?.classList.toggle('hidden', !showingCollection);
    collectionPanel?.setAttribute('aria-hidden', String(!showingCollection));
    if (toggle) {
        toggle.textContent = showingCollection ? 'Ver Tienda' : 'Ver colección';
        toggle.setAttribute('aria-expanded', String(showingCollection));
    }
    if (showingCollection) renderCollectionView();
    else renderShopView();
}

function _bindShopScrollVisibility() {
    const toggle = document.getElementById('btn-toggle-collection');
    if (!toggle) return;
    _lastShopScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        if (_shopScrollFrame !== null || document.getElementById('view-shop')?.classList.contains('hidden')) return;
        _shopScrollFrame = requestAnimationFrame(() => {
            _shopScrollFrame = null;
            const currentY = window.scrollY;
            const isScrollingDown = currentY > _lastShopScrollY && currentY > 8;
            toggle.classList.toggle('shop-view-toggle--scroll-hidden', isScrollingDown);
            _lastShopScrollY = currentY;
        });
    }, { passive: true });
}

// ── Render: Streak Calendar ───────────────────────────────────────────────────
function renderStreakCalendar() {
    const cal = document.getElementById('settings-streak-calendar');
    if (!cal) return;
    const info    = window.GameCenter?.getStreakInfo?.();
    const streak  = info?.streak || 0;
    const days    = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
    const rewards = [20, 25, 30, 35, 40, 50, 60];

    cal.innerHTML = days.map((day, i) => {
        let cls = 'streak-cal-dot';
        if      (i < streak)  cls += ' claimed';
        else if (i === streak) cls += ' today';
        return `<div class="streak-cal-day">
            <span class="streak-cal-label">${day}</span>
            <div class="${cls}" title="${rewards[i]} monedas">
                ${i < streak ? '<svg class="icon" width="10" height="10" aria-hidden="true"><use href="#icon-check"></use></svg>' : rewards[i]}
            </div>
        </div>`;
    }).join('');
}

function _getCardAspectRatio(catalogIndex) {
    return catalogIndex % 2 === 0 ? '9:16' : '3:4';
}

function _getThumbnailWidth(container) {
    const gap = 10;
    const cssWidth = Math.max(160, ((container?.clientWidth || 640) - gap) / 2);
    return Math.ceil(cssWidth * Math.min(window.devicePixelRatio || 1, 2));
}

function _buildShopCard(item, loading = 'lazy', catalogIndex = 0, thumbnailWidth = 640) {
    const article = document.createElement('article');
    const aspectRatio = _getCardAspectRatio(catalogIndex);
    const isOwned = GameCenter.getBoughtCount(item.id) > 0;
    article.className = 'shop-card';
    article.dataset.itemId = String(item.id);
    article.dataset.aspectRatio = aspectRatio;
    article.dataset.thumbnailWidth = String(thumbnailWidth);

    const button = document.createElement('button');
    button.className = 'shop-visual-card';
    button.type = 'button';
    button.dataset.itemId = String(item.id);
    button.setAttribute('aria-label', `Ver ${item.name}`);

    const image = document.createElement('img');
    image.className = 'shop-img';
    image.src = getThumbnailUrl(item.imageUrl, aspectRatio, thumbnailWidth);
    image.alt = item.name;
    image.loading = loading;
    image.decoding = 'async';
    if (loading === 'eager') image.fetchPriority = 'high';
    image.addEventListener('error', () => {
        article.classList.add('shop-card--image-error');
        image.remove();
    }, { once: true });
    button.append(image);

    if (window.ECONOMY?.isSaleActive && !isOwned) {
        const badge = document.createElement('span');
        badge.className = 'shop-sale-pill';
        badge.textContent = window.ECONOMY.saleLabel;
        badge.setAttribute('aria-hidden', 'true');
        button.append(badge);
    }

    article.append(button);
    return article;
}

function _createShopRails(container) {
    const rails = [0, 1].map(index => {
        const rail = document.createElement('div');
        rail.className = 'shop-rail';
        rail.dataset.rail = String(index);
        container.append(rail);
        return rail;
    });
    return rails;
}

function _teardownShopLazyRender() {
    if (_shopLazyObserver) {
        _shopLazyObserver.disconnect();
        _shopLazyObserver = null;
    }
    if (_shopLazySentinel) {
        _shopLazySentinel.remove();
        _shopLazySentinel = null;
    }
}

function _appendShopBatch(container) {
    const start = _shopRenderState.cursor;
    const end   = Math.min(start + _shopRenderState.batchSize, _shopRenderState.items.length);
    if (start >= end) return false;

    const newCards = [];
    for (let i = start; i < end; i += 1) {
        // Mark first 6 items of the entire catalog to load eagerly.
        // i is the global index in _shopRenderState.items.
        const loading = i < 6 ? 'eager' : 'lazy';
        const item = _shopRenderState.items[i];
        const catalogIndex = allItems.indexOf(item);
        const card = _buildShopCard(item, loading, catalogIndex, _shopRenderState.thumbnailWidth);
        newCards.push(card);
        _shopRenderState.rails[catalogIndex % 2].append(card);
    }
    _shopRenderState.cursor = end;

    _observeNewShopCards(newCards);
    return end < _shopRenderState.items.length;
}

// ── Render: Catálogo (lazy incremental mounting) ─────────────────────────────
function renderShop(items) {
    const container = document.getElementById('shop-container');
    _teardownShopLazyRender();
    container.innerHTML = '';

    _shopRenderState.items  = items;
    _shopRenderState.cursor = 0;
    _shopRenderState.rails = _createShopRails(container);
    _shopRenderState.thumbnailWidth = _getThumbnailWidth(container);

    // El DOM se acaba de reemplazar: esta es la única ruta que reinicia el
    // observer y su cola. Los lotes siguientes solo observan sus cards nuevas.
    _initPreloadObserver(container, items);
    if (!items.length) return;
    const hasMore = _appendShopBatch(container);
    if (!hasMore) return;

    _shopLazySentinel = document.createElement('div');
    _shopLazySentinel.className = 'shop-lazy-sentinel';
    _shopLazySentinel.setAttribute('aria-hidden', 'true');
    container.appendChild(_shopLazySentinel);

    if (!('IntersectionObserver' in window)) {
        while (_appendShopBatch(container)) { /* fallback eager append */ }
        return;
    }

    _shopLazyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const stillHasMore = _appendShopBatch(container);
            if (!stillHasMore) _teardownShopLazyRender();
        });
    }, { rootMargin: '500px 0px 700px 0px', threshold: 0 });

    _shopLazyObserver.observe(_shopLazySentinel);
}

function _bindShopContainerDelegation() {
    if (_shopDelegationBound) return;
    const container = document.getElementById('shop-container');
    if (!container) return;
    _shopDelegationBound = true;

    let pointerStart = null;
    const cancelPointer = () => { pointerStart = null; };
    container.addEventListener('pointerdown', (event) => {
        const visualCard = event.target.closest('.shop-visual-card');
        if (!visualCard) return;
        pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, card: visualCard };
    });
    container.addEventListener('pointermove', (event) => {
        if (!pointerStart || event.pointerId !== pointerStart.id) return;
        if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8) cancelPointer();
    });
    container.addEventListener('pointercancel', cancelPointer);
    container.addEventListener('selectstart', cancelPointer);
    container.addEventListener('click', (event) => {
        if (event.detail !== 0) return; // Native keyboard activation.
        const visualCard = event.target.closest('.shop-visual-card');
        const item = allItems.find(candidate => candidate.id === Number(visualCard?.dataset.itemId));
        if (item) openPreviewModal(item);
    });
    container.addEventListener('pointerup', (event) => {
        if (!pointerStart || event.pointerId !== pointerStart.id) return;
        const activation = pointerStart;
        cancelPointer();
        if (event.timeStamp - activation.time > 500 || Math.hypot(event.clientX - activation.x, event.clientY - activation.y) > 8) return;
        const item = allItems.find(candidate => candidate.id === Number(activation.card.dataset.itemId));
        if (item) openPreviewModal(item);
    });
    window.addEventListener('scroll', cancelPointer, { passive: true });
}

// ── Render: Colección (solo tras su primer montaje) ──────────────────────────
function renderCollection(owned, isSearching = false) {
    if (!_collectionMounted) return;
    const container = document.getElementById('collection-container');
    if (!container) return;
    container.replaceChildren();

    if (owned.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'collection-empty-state';
        empty.textContent = isSearching ? 'No hay coincidencias. Prueba con otro nombre.' : 'Tu colección está vacía.';
        container.append(empty);
        return;
    }

    const rails = _createShopRails(container);
    const thumbnailWidth = _getThumbnailWidth(container);
    owned.forEach((item) => {
        const catalogIndex = allItems.indexOf(item);
        const card = _buildShopCard(item, 'lazy', catalogIndex, thumbnailWidth);
        rails[catalogIndex % 2].append(card);
    });
}

// ── Render: Historial ─────────────────────────────────────────────────────────
function renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;
    const history = GameCenter.getHistory();

    if (!history.length) {
        container.innerHTML =
            '<div class="history-empty-state"><strong>Aún no hay movimientos.</strong><span>Cuando ganes o gastes monedas, aparecerán aquí.</span></div>';
        return;
    }

    container.innerHTML = history.slice(0, 50).map(entry => {
        if (entry.tipo) {
            const isIn  = entry.tipo === 'ingreso';
            const fecha = new Date(entry.fecha).toLocaleString('es-MX', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });
            return `<div class="history-entry">
                <span class="history-icon ${isIn ? 'history-icon--in' : 'history-icon--out'}">${isIn ? '+' : '-'}</span>
                <div class="history-detail">
                    <span class="history-motivo">${entry.motivo}</span>
                    <span class="history-fecha">${fecha}</span>
                </div>
                <span class="history-amount ${isIn ? 'history-amount--in' : 'history-amount--out'}">
                    ${isIn ? '+' : '-'}${entry.cantidad}
                </span>
            </div>`;
        } else {
            // Formato legado v7.2 (anterior a la migración SPA). Las entradas antiguas
            // usaban { date, itemId, name, price } en lugar de { fecha, tipo, cantidad, motivo }.
            // Este branch permanece activo para stores que no han pasado por migrateState()
            // todavía (primera carga desde v7.2 sin haber exportado e importado).
            // Puede retirarse cuando se confirme que ningún usuario activo tiene stores pre-v7.5.
            const fecha  = entry.date
                ? new Date(entry.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : '—';
            const isCode = entry.itemId === 'promo_code';
            return `<div class="history-entry">
                <span class="history-icon ${isCode ? 'history-icon--in' : 'history-icon--out'}">${isCode ? '+' : '-'}</span>
                <div class="history-detail">
                    <span class="history-motivo">${entry.name || 'Transacción'}</span>
                    <span class="history-fecha">${fecha}</span>
                </div>
                <span class="history-amount ${isCode ? 'history-amount--in' : 'history-amount--out'}">
                    ${isCode ? `+${entry.price || '?'}` : `-${entry.price || '?'}`}
                </span>
            </div>`;
        }
    }).join('');
}

/**
 * Aplica la animación de "shake" a un elemento sin forzar un layout reflow síncrono.
 *
 * El patrón clásico `void el.offsetWidth` fuerza al navegador a calcular el layout
 * completo del documento para obtener offsetWidth, lo cual es la operación de
 * layout más costosa. El doble requestAnimationFrame evita ese coste: el primer RAF
 * espera a que el browser haya procesado la eliminación de la clase en el frame
 * actual; el segundo RAF aplica la clase de nuevo en el siguiente frame, logrando
 * el reset de animación sin tocar el árbol de layout.
 *
 * @param {HTMLElement} el  Elemento al que aplicar la animación.
 */
function shakeElement(el) {
    el.classList.remove('anim-shake');
    // Doble RAF: reinicia la animación CSS sin forzar layout reflow (reemplaza void el.offsetWidth).
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            el.classList.add('anim-shake');
            el.addEventListener('animationend', () => el.classList.remove('anim-shake'), { once: true });
        });
    });
}

// ── Confetti ──────────────────────────────────────────────────────────────────
let _confettiLoaderPromise = null;

/**
 * Detecta señales de capacidad limitada sin depender de user-agent sniffing.
 * La heurística solo reduce la intensidad del efecto; nunca lo desactiva.
 *
 * @returns {boolean}
 */
function _isModestDevice() {
    const cores = navigator.hardwareConcurrency;
    return (Number.isFinite(cores) && cores <= 4) || _isDataSaverActive() || _isLowBandwidth();
}

function _getConfetti() {
    if (typeof window.confetti === 'function') return Promise.resolve(window.confetti);
    if (_confettiLoaderPromise) return _confettiLoaderPromise;

    _confettiLoaderPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js';
        script.async = true;
        script.onload = () => resolve(typeof window.confetti === 'function' ? window.confetti : null);
        script.onerror = () => resolve(null); // fallback silencioso
        document.head.appendChild(script);
    }).catch(() => null);

    return _confettiLoaderPromise;
}

/**
 * Ejecuta el confeti después del próximo paint para no competir con la
 * actualización síncrona de saldo, badges e inventario.
 *
 * @param {'purchase'|'redeem'} type
 */
function _scheduleConfetti(type) {
    requestAnimationFrame(() => fireConfetti(type));
}

async function fireConfetti(type = 'purchase') {
    // No disparar si la pestaña está inactiva (performance)
    if (document.hidden) return;
    // Verificar que estamos en la vista de Tienda
    if (window.SpaRouter?.getCurrentView?.() !== 'shop') return;

    const confettiFn = await _getConfetti();
    if (typeof confettiFn !== 'function') return; // fallback silencioso
    // La carga lazy puede completar después de navegar o cambiar de pestaña.
    if (document.hidden || window.SpaRouter?.getCurrentView?.() !== 'shop') return;

    const modestDevice = _isModestDevice();
    if (type === 'redeem') {
        confettiFn({
            particleCount: modestDevice ? 45 : 80,
            spread: 100,
            origin: { y: 0.4 },
            colors: ['#fbbf24', '#9b59ff', '#22d07a']
        });
        return;
    }

    const colors = ['#9b59ff', '#ff59b4', '#fbbf24', '#22d07a', '#00d4ff'];
    const particleCount = modestDevice ? 30 : 55;
    confettiFn({ particleCount, angle: 60,  spread: 65, origin: { x: 0, y: 0.7 }, colors });
    confettiFn({ particleCount, angle: 120, spread: 65, origin: { x: 1, y: 0.7 }, colors });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(html, type = 'success') {
    const toast     = document.createElement('div');
    toast.className = `toast toast--${type}`;
    if (type === 'warning') {
        toast.classList.add('toast--warning');
        toast.style.borderColor = '#f59e0b';
        toast.style.color = '#f59e0b';
    }
    toast.innerHTML = html;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => {
        toast.classList.remove('toast--visible');
        // .remove() tras la animación → limpieza del DOM (no solo ocultado)
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

// ── Código Promo ──────────────────────────────────────────────────────────────
async function handleRedeem() {
    if (isRedeeming) return;

    const input  = document.getElementById('promo-input');
    const msg    = document.getElementById('promo-msg');
    const btn    = document.getElementById('btn-redeem');
    if (!input || !msg || !btn) return;
    const code   = input.value.trim();
    if (!code) return;

    isRedeeming = true;
    btn.disabled = true;
    try {
        const result = await window.GameCenter.redeemPromoCode(code);

        if (result.success) {
            showMsg(msg, result.message, 'var(--success)');
            input.value = '';
            input.style.borderColor = '';
            input.removeAttribute('aria-invalid');
            // Actualizar displays: navbar con formato abreviado, resto con valor exacto.
            const bal = GameCenter.getBalance();
            document.querySelectorAll('.navbar .coin-display').forEach(el => {
                el.textContent = window.formatCoinsNavbar?.(bal) ?? bal;
                el.closest('.coin-badge')?.setAttribute('title', `${bal} monedas`);
            });
            document.querySelectorAll('.coin-display:not(.navbar .coin-display)').forEach(el => el.textContent = bal);
            // El feedback crítico ya está actualizado; el efecto decorativo va
            // en el siguiente frame y comparte los mismos guards que la compra.
            _scheduleConfetti('redeem');
            // [v9.9.2] Fuente ÚNICA de track('redeem_code'): aquí, al final de la cadena
            // de éxito de UI. El disparo en app.js/redeemPromoCode() fue eliminado para
            // evitar el doble reporte. Código ofuscado con *** para no exponer texto plano.
            window.GhostAnalytics?.track('redeem_code', {
                recompensa: result.reward,
                código:     `${code.slice(0, 3)}***`
            });
        } else {
            showMsg(msg, result.message, 'var(--error)');
            input.style.borderColor = 'var(--error)';
            input.setAttribute('aria-invalid', 'true');
            shakeElement(btn);

            // [v9.9.2] Fricción de usuario: código que no existe en absoluto.
            // Solo se trackea cuando el código es desconocido ('Código inválido'),
            // no cuando ya fue canjeado ('Ya canjeaste este código') para evitar
            // saturar el canal con intentos legítimos pero repetidos.
            if (result.message === 'Código inválido') {
                window.GhostAnalytics?.track('invalid_promo_code', {
                    intento: `${code.slice(0, 3)}***`,
                    longitud: code.length
                });
            }
        }
    } catch (error) {
        showMsg(msg, 'Ocurrió un error al canjear el código. Inténtalo de nuevo.', 'var(--error)');
        input.style.borderColor = 'var(--error)';
        input.setAttribute('aria-invalid', 'true');
        shakeElement(btn);
        window.GhostAnalytics?.track('bug', {
            módulo: 'shop-logic',
            acción: 'redeem_code',
            detalle: error?.message || 'redeemPromoCode_failed'
        });
    } finally {
        btn.disabled = false;
        isRedeeming = false;
    }
}

// ── Sincronización ────────────────────────────────────────────────────────────
async function handleExport() {
    const msg = document.getElementById('export-msg');
    const btn = document.getElementById('btn-export');
    btn.disabled = true;
    showMsg(msg, 'Procesando…', 'var(--text-low)');
    const result = await window.BackupEngine?.exportBackup({
        onStatus: (type, message) => {
            if (type === 'processing') showMsg(msg, message, 'var(--text-low)');
        }
    });
    btn.disabled = false;

    if (!result?.success) {
        showMsg(msg, result?.message || 'Error al crear el respaldo.', 'var(--error)');
        return;
    }

    // [v9.9.2] Mide cuántos usuarios utilizan la sincronización entre dispositivos.
    window.GhostAnalytics?.track('sync_export', {
        formato: 'labak'
    });
    showMsg(msg, '✓ Copia de seguridad creada.', 'var(--success)');
}

async function handleImport() {
    const msg  = document.getElementById('import-msg');
    const btn  = document.getElementById('btn-import');
    const input = document.getElementById('import-file');
    const file = input?.files?.[0] || null;

    if (!file) { showMsg(msg, 'Selecciona un archivo .labak.', 'var(--error)'); return; }

    const confirmed = await openConfirmModal({
        title:    'Importar partida',
        bodyHTML:
            `<div class="modal-warning">
                Esto <strong>reemplazará tu progreso actual</strong> (monedas, wallpapers, racha y ajustes).<br><br>
                Esta acción no se puede deshacer.
            </div>`,
        confirmText: 'Sí, importar'
    });
    if (!confirmed) return;

    btn.disabled = true;
    showMsg(msg, 'Procesando…', 'var(--text-low)');
    const result = await window.BackupEngine?.importBackupFromFile(file, {
        onStatus: (type, message) => {
            if (type === 'processing') showMsg(msg, message, 'var(--text-low)');
        }
    });
    btn.disabled = false;

    if (result.success) {
        showMsg(msg, '✓ Progreso restaurado con éxito. Recargando…', 'var(--success)');
        setTimeout(() => location.reload(), 1200);
    } else {
        showMsg(msg, result.message || 'Archivo inválido o corrupto.', 'var(--error)');
    }
}

// ── Moon Blessing Status ──────────────────────────────────────────────────────
function renderMoonBlessingStatus() {
    const status   = GameCenter.getMoonBlessingStatus();
    const statusEl = document.getElementById('moon-blessing-status');
    if (!statusEl) return;
    if (status.active) {
        statusEl.textContent = `Activa · expira ${status.expiresAt}`;
        statusEl.className   = 'eco-badge eco-badge--moon';
    } else {
        statusEl.textContent = 'Inactiva';
        statusEl.className   = 'eco-badge';
    }
}

// ── Util ──────────────────────────────────────────────────────────────────────
function showMsg(el, text, color) {
    if (!el) return;
    el.innerHTML     = text;
    el.style.color   = color;
    el.style.opacity = '1';
}

// ── Email Modal ───────────────────────────────────────────────────────────────
let _emailItem        = null;
let _emailAbsoluteUrl = '';

function openEmailModal(item, absoluteUrl) {
    _emailItem        = item;
    _emailAbsoluteUrl = absoluteUrl;

    const thumbEl = document.getElementById('email-modal-thumb');
    const nameEl  = document.getElementById('email-modal-item-name');
    if (thumbEl) { thumbEl.src = item.imageUrl; thumbEl.alt = item.name; }
    if (nameEl)  { nameEl.textContent = item.name; }

    const inputEl = document.getElementById('email-modal-input');
    if (inputEl) {
        inputEl.value = window.MailHelper.getLastMailRecipient();
        _setEmailError(false);
    }

    const fallbackEl = document.getElementById('email-fallback');
    if (fallbackEl) fallbackEl.classList.remove('visible');

    const modal = document.getElementById('email-modal');
    // Guardar foco activo para restaurarlo al cerrar el modal (WCAG 2.4.3).
    _lastFocusedElement = document.activeElement;
    modal.classList.remove('hidden');
    window.ModalA11y?.open?.(modal, _lastFocusedElement);
    requestAnimationFrame(() => { if (inputEl) inputEl.focus(); });
}

function _closeEmailModal() {
    const emailModal = document.getElementById('email-modal');
    emailModal.classList.add('hidden');
    window.ModalA11y?.close?.(emailModal);
    _emailItem        = null;
    _emailAbsoluteUrl = '';
    // Restaurar foco al botón de envío que abrió el modal (WCAG 2.4.3).
    _lastFocusedElement?.focus();
    _lastFocusedElement = null;
}

function _setEmailError(show, msg = 'Introduce un correo electrónico válido.') {
    const errorEl   = document.getElementById('email-modal-error');
    const errorText = document.getElementById('email-modal-error-text');
    const inputEl   = document.getElementById('email-modal-input');
    if (!errorEl || !inputEl) return;
    if (show) {
        if (errorText) errorText.textContent = msg;
        errorEl.classList.add('visible');
        inputEl.classList.add('email-input--error');
        inputEl.setAttribute('aria-invalid', 'true');
    } else {
        errorEl.classList.remove('visible');
        inputEl.classList.remove('email-input--error');
        inputEl.setAttribute('aria-invalid', 'false');
    }
}

async function _handleEmailConfirm() {
    if (!_emailItem || !_emailAbsoluteUrl) return;

    const inputEl    = document.getElementById('email-modal-input');
    const saveCb     = document.getElementById('email-save-checkbox');
    const fallbackEl = document.getElementById('email-fallback');
    const fallUrlEl  = document.getElementById('email-fallback-url');

    const email = (inputEl?.value || '').trim();

    if (!window.MailHelper.isValidEmail(email)) {
        _setEmailError(true);
        inputEl?.focus();
        return;
    }
    _setEmailError(false);

    const { uri, tooLong } = window.MailHelper.buildMailtoLink(_emailItem, _emailAbsoluteUrl, email);

    if (tooLong) {
        if (fallbackEl) fallbackEl.classList.add('visible');
        if (fallUrlEl)  fallUrlEl.textContent = _emailAbsoluteUrl;

        const copyBtn = document.getElementById('email-copy-btn');
        if (copyBtn) {
            const freshBtn = copyBtn.cloneNode(true);
            copyBtn.parentNode.replaceChild(freshBtn, copyBtn);
            document.getElementById('email-copy-btn').addEventListener('click', async () => {
                const ok  = await window.MailHelper.copyToClipboard(_emailAbsoluteUrl);
                const lbl = document.getElementById('email-copy-label');
                if (lbl) lbl.textContent = ok ? '✓ Enlace copiado' : 'No se pudo copiar';
                setTimeout(() => { if (lbl) lbl.textContent = 'Copiar enlace de descarga'; }, 2500);
            });
        }
        if (saveCb?.checked) window.MailHelper.saveLastMailRecipient(email);
        return;
    }

    if (saveCb?.checked) window.MailHelper.saveLastMailRecipient(email);
    window.location.href = uri;
    setTimeout(_closeEmailModal, 300);
}

// ── ShopView API pública (usada por spa-router.js) ────────────────────────────
window.ShopView = {
    /**
     * Llamado por spa-router.js cada vez que se entra a la vista de Tienda.
     * Refresca los datos visibles sin re-renderizar el catálogo completo
     * (que ya está en memoria).
     */
    onEnter() {
        renderMoonBlessingStatus();
        // Actualizar saldo en todos los coin-display:
        // la navbar usa el formato abreviado (ej: "25.5k") y el resto el valor exacto.
        const balance = window.GameCenter?.getBalance?.() ?? 0;
        document.querySelectorAll('.navbar .coin-display').forEach(el => {
            el.textContent = window.formatCoinsNavbar?.(balance) ?? balance;
            el.closest('.coin-badge')?.setAttribute('title', `${balance} monedas`);
        });
        document.querySelectorAll('.coin-display:not(.navbar .coin-display)').forEach(el => {
            el.textContent = balance;
        });
        if (allItems.length) {
            if (activeShopView === 'collection') renderCollectionView();
            else renderShopView();
        }

    },

    /**
     * Llamado por spa-router.js al salir de Tienda.
     * El observer de precarga se conserva mientras el grid no cambie: así una
     * reentrada con la misma firma no desconecta ni vuelve a observar las cards.
     * renderShop() sigue siendo el único punto que lo reinicializa al cambiar DOM.
     */
    onLeave() {}
};

// ── Carga del catálogo con manejo de errores y reintento ─────────────────────

/**
 * Persiste el hash del catálogo fuera del camino crítico de renderizado.
 * El hash solo informa el estado de notificaciones push, por lo que el grid y
 * la Colección deben estar disponibles antes de calcularlo. La revisión evita
 * que una carga anterior sobrescriba el hash de un reintento más reciente.
 */
function _scheduleCatalogHashPersistence(items, revision) {
    const persistHash = () => {
        if (_catalogRevision !== revision) return;
        try {
            const bytes = new TextEncoder().encode(JSON.stringify(items));
            const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
            const catalogHash = btoa(binary).slice(0, 120);
            localStorage.setItem('love_arcade_shop_catalog_hash_v1', catalogHash);
        } catch (_) {}
    };

    if ('requestIdleCallback' in window) {
        requestIdleCallback(persistHash, { timeout: 1000 });
    } else {
        setTimeout(persistHash, 0);
    }
}

/**
 * Descarga shop.json y renderiza el catálogo.
 * Si la petición falla (red, 404, 500), oculta el grid y muestra
 * #shop-error-state con un botón de reintento que vuelve a llamar a esta función.
 *
 * Puede llamarse múltiples veces de forma segura (retry pattern):
 * cada invocación resetea el estado de error y muestra el indicador de carga.
 */
function loadCatalog() {
    const gridEl    = document.getElementById('shop-container');
    const errorEl   = document.getElementById('shop-error-state');
    const retryBtn  = document.getElementById('btn-retry-shop');
    const emptyEl   = document.getElementById('shop-empty-state');

    // Mostrar estado de carga; ocultar error previo y grid
    if (gridEl)  { gridEl.classList.add('hidden'); gridEl.innerHTML = ''; }
    if (emptyEl) emptyEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');

    // Mostrar spinner en el grid mientras carga
    if (gridEl) {
        gridEl.classList.remove('hidden');
        gridEl.innerHTML =
            '<p style="color:var(--text-low); grid-column:1/-1; text-align:center; padding:40px 0;">' +
            '<svg class="icon" width="24" height="24" aria-hidden="true"><use href="#icon-loader"></use></svg>' +
            'Cargando catálogo…</p>';
    }

    fetch('data/shop.json')
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then(items => {
            allItems = _validateCatalog(items);
            _catalogRevision += 1;
            if (gridEl) gridEl.innerHTML = '';
            if (_collectionMounted) _collectionSearchIndex = new Map(allItems.map(item => [item.id, item.name.toLocaleLowerCase()]));
            renderShopView();
            if (_collectionMounted) renderCollectionView();
            _scheduleCatalogHashPersistence(allItems, _catalogRevision);
            if (errorEl) errorEl.classList.add('hidden');

            if (!sessionStorage.getItem('ga_snapshot_sent')) {
                try {
                    sessionStorage.setItem('ga_snapshot_sent', '1');
                    const gc = window.GameCenter;
                    const inventory = gc?.getInventory?.() || {};
                    const comprados = Object.values(inventory).filter(v => v > 0).length;
                    const disponibles = allItems.length - comprados;
                    const state = gc?.getState?.() || {};
                    window.GhostAnalytics?.track('user_snapshot', {
                        saldo: state.coins ?? gc?.getBalance?.() ?? 0,
                        comprados, disponibles, racha: state.streak ?? 0,
                        códigos_canjeados: gc?.getRedeemedCount?.() ?? 0
                    });
                } catch (_) { /* nunca interrumpir la carga del catálogo */ }
            }
        })
        .catch(err => {
            console.error('[ShopLogic] Error cargando shop.json:', err);
            if (gridEl) gridEl.classList.add('hidden');
            if (emptyEl) emptyEl.classList.add('hidden');
            if (errorEl) errorEl.classList.remove('hidden');
            if (retryBtn && !retryBtn.dataset.bound) {
                retryBtn.dataset.bound = 'true';
                retryBtn.addEventListener('click', () => {
                    delete retryBtn.dataset.bound;
                    loadCatalog();
                });
            }
        });
}

/** Validates the published Ticket-01 catalog contract before it reaches the UI. */
function _validateCatalog(items) {
    if (!Array.isArray(items)) throw new Error('El catálogo debe ser un array.');
    const ids = new Set();
    return items.map((item, index) => {
        const valid = item && Number.isInteger(item.id) && item.id >= 0
            && !ids.has(item.id)
            && typeof item.name === 'string' && item.name.trim()
            && Number.isInteger(item.price) && item.price >= 0
            && (item.type === 'image' || item.type === 'file')
            && typeof item.imageUrl === 'string' && item.imageUrl.trim()
            && (item.type !== 'file' || (typeof item.downloadUrl === 'string' && item.downloadUrl.trim()));
        if (!valid) throw new Error(`Entrada de catálogo inválida en índice ${index}.`);
        ids.add(item.id);
        return item;
    });
}

// ── DOMContentLoaded — Registro de event listeners (una sola vez) ─────────────
document.addEventListener('DOMContentLoaded', () => {
    _bindShopContainerDelegation();

    // Inicializar el estado visible de la Tienda al cargar.
    renderMoonBlessingStatus();
    renderStreakCalendar();

    // Confirm modal
    document.getElementById('modal-cancel').addEventListener('click',  () => _closeModal(false));
    document.getElementById('modal-confirm').addEventListener('click', () => _closeModal(true));
    document.getElementById('confirm-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) _closeModal(false);
    });

    // Preview modal: backdrop preserves the active dialog's focus contract.
    document.getElementById('preview-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closePreviewModal();
    });

    // Email modal
    document.getElementById('email-modal-cancel').addEventListener('click', _closeEmailModal);
    document.getElementById('email-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) _closeEmailModal();
    });
    document.getElementById('email-modal-confirm').addEventListener('click', _handleEmailConfirm);
    document.getElementById('email-modal-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') _handleEmailConfirm();
    });
    document.getElementById('email-modal-input').addEventListener('input', () => {
        _setEmailError(false);
    });

    // Escape global cierra todos los modales
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            const confirmModal = document.getElementById('confirm-modal');
            confirmModal.classList.add('hidden');
            window.ModalA11y?.close?.(confirmModal);
            closePreviewModal();
            _closeEmailModal();
        }
    });

    // ── Cargar catálogo UNA SOLA VEZ (con manejo de errores y reintento) ────────
    loadCatalog();

    // Código promocional: el formulario vive en el panel dedicado de Perfil.
    document.getElementById('btn-redeem')?.addEventListener('click', handleRedeem);
    document.getElementById('promo-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleRedeem();
    });

    document.getElementById('btn-toggle-collection')?.addEventListener('click', () => {
        switchShopView(activeShopView === 'shop' ? 'collection' : 'shop');
    });
    document.getElementById('btn-open-collection')?.addEventListener('click', () => switchShopView('collection'));
    _bindShopScrollVisibility();


    // Navegación interna de Perfil: pantallas dedicadas tipo app, sin acordeones.
    const profileView = document.getElementById('view-profile');
    const profileHome = profileView?.querySelector('[data-profile-panel="home"]');
    let profileLastTrigger = null;

    function showProfilePanel(panelName, trigger) {
        if (!profileView || !profileHome) return;
        if (trigger) profileLastTrigger = trigger;
        profileView.querySelectorAll('[data-profile-panel]').forEach(panel => {
            panel.classList.toggle('hidden', panel.dataset.profilePanel !== panelName);
        });

        if (panelName === 'personalization') {
            window.GameCenter?.syncUI?.();
        }
        if (panelName === 'upgrades') {
            renderMoonBlessingStatus();
        }
        if (panelName === 'history') {
            renderHistory();
        }

        if (panelName === 'promotions') {
            const promoInput = profileView.querySelector('#promo-input');
            requestAnimationFrame(() => promoInput?.focus?.({ preventScroll: true }));
            return;
        }

        const activePanel = profileView.querySelector(`[data-profile-panel="${panelName}"]`);
        requestAnimationFrame(() => {
            const focusTarget = activePanel?.querySelector('[data-profile-back], button, input, [tabindex]:not([tabindex="-1"])');
            focusTarget?.focus?.({ preventScroll: true });
        });
    }

    profileView?.querySelectorAll('[data-profile-target]').forEach(btn => {
        btn.addEventListener('click', () => showProfilePanel(btn.dataset.profileTarget, btn));
    });

    profileView?.querySelectorAll('[data-profile-back]').forEach(btn => {
        btn.addEventListener('click', () => {
            showProfilePanel('home');
            requestAnimationFrame(() => profileLastTrigger?.focus?.({ preventScroll: true }));
        });
    });



    // Sync
    document.getElementById('btn-export')?.addEventListener('click', handleExport);
    document.getElementById('btn-import')?.addEventListener('click', () => {
        const fileInput = document.getElementById('import-file');
        if (!fileInput?.files?.length) {
            window.BackupEngine?.triggerImportPicker(fileInput);
            return;
        }
        handleImport();
    });

    document.getElementById('import-file')?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const nameEl = document.getElementById('import-file-name');
        if (nameEl) nameEl.textContent = file.name;
        showMsg(document.getElementById('import-msg'),
            `Archivo "${file.name}" listo. Haz clic en Importar.`, 'var(--text-med)');
    });

    // Moon Blessing button
    const moonBtn = document.getElementById('btn-moon-blessing');
    if (moonBtn) {
        moonBtn.addEventListener('click', () => {
            const result = window.GameCenter.buyMoonBlessing();
            const msg    = document.getElementById('moon-blessing-msg');
            if (result.success) {
                if (msg) { msg.textContent = `✓ Activa hasta ${result.expiresAt}`; msg.style.color = '#c084fc'; }
            } else {
                if (msg) { msg.textContent = '✗ Monedas insuficientes (necesitas 100)'; msg.style.color = '#ff4757'; }
            }
            if (msg) {
                msg.style.opacity = '1';
                setTimeout(() => { msg.style.opacity = '0'; }, 3500);
            }
            renderMoonBlessingStatus();
        });
    }

    // NOTA: El listener de .theme-btn fue eliminado de shop-logic.js (SPA Migration).
    // El tema es una configuración global; su único handler vive en app.js,
    // donde setTheme() actualiza el store, los CSS vars, la clase theme-{key}
    // en <body> y el estado visual de todos los .theme-btn desde un único lugar.

});
