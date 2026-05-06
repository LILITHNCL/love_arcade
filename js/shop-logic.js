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
 *  - buy_item: GhostAnalytics.track() en initiatePurchase() tras compra exitosa.
 *    Registra nombre del wallpaper, precio final, cashback y categoría.
 *  - Los hooks anteriores (view_preview, click_download, redeem_code) se mantienen.
 *  - view_preview: GhostAnalytics.track() en openPreviewModal() inmediatamente
 *    tras modal.classList.remove('hidden') — fase síncrona, sin depender del rAF.
 *  - click_download: listeners añadidos en renderLibrary() (fuente:"biblioteca")
 *    y en el bloque isOwned de openPreviewModal() (fuente:"preview") sobre los
 *    <a download> generados dinámicamente.
 *  - redeem_code: GhostAnalytics.track() en handleRedeem() cuando result.success.
 *    El código original se ofusca con *** antes de enviarlo.
 *  - Todas las llamadas usan optional chaining (?.) para que el módulo sea
 *    no-operativo si analytics.js no está cargado.
 *
 * NOVEDADES v9.8 (Mobile Performance Pass — Scroll & Modal Lag):
 *  - openPreviewModal(): REFACTOR de dos fases para eliminar freeze en gama baja.
 *    Antes: _buildMockupHTML() (~16 SVG inline) se ejecutaba de forma síncrona
 *    antes de que el modal fuera visible, bloqueando el hilo principal 50–150 ms
 *    y causando que la animación modalPopIn nunca renderizara su frame inicial.
 *    Ahora: modal.classList.remove('hidden') se llama de forma síncrona (<1 ms),
 *    dando respuesta visual inmediata. _buildMockupHTML() y toda la lógica de
 *    carga de imágenes se difieren a requestAnimationFrame, donde el overlay ya
 *    está pintado y el trabajo pesado no bloquea la percepción del usuario.
 *    Los botones de acción (DOM mínimo) se construyen de forma síncrona para
 *    mantener el foco accesible en el primer frame.
 *  - Nota: los cambios CSS relacionados (backdrop-filter, laserScan, etc.)
 *    se documentan en styles.css v9.8.
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
 *  - Nueva función privada _applyArtFallback(artEl): aplica un degradado CSS
 *    puro (sin recursos externos) cuando Cloudinary es inalcanzable. Idempotente:
 *    segura de llamar desde Phase 1 y Phase 2 simultáneamente.
 *  - openPreviewModal() — Phase 1: se añade una Image() de prueba en paralelo
 *    (thumbProbe) para detectar fallos CDN en la thumbnail. Si thumbProbe.onerror
 *    dispara, cancela el load de Phase 2 y aplica _applyArtFallback inmediatamente.
 *  - openPreviewModal() — Phase 2: hiRes.onerror ya no se limita a quitar la
 *    clase de carga; ahora evalúa si la thumbnail cargó correctamente (_thumbOk):
 *      · _thumbOk = true  → el CDN funciona pero falta el archivo hi-res;
 *                           degrade a la thumbnail visible (blur→clear).
 *      · _thumbOk = false → CDN totalmente inaccesible; aplica _applyArtFallback.
 *  - renderShop() y renderLibrary(): los <img> de catálogo y biblioteca incluyen
 *    onerror inline que añade .shop-img--offline y limpia el src para suprimir
 *    el icono de imagen rota del navegador.
 *  - styles.css: nuevas clases .mockup-layer-art.mockup-bg-offline y
 *    .shop-img--offline con gradientes CSS puros (sin fetch externo).
 *
 * NOVEDADES v9.5 (Cloudinary CDN Migration):
 *  - assets/product-thumbs/ ELIMINADA. Las thumbnails del catálogo se cargan
 *    desde Cloudinary con la transformación ar_16:9,c_fill,g_auto,w_640.
 *    El campo `image` de shop.json ahora apunta directamente a la URL CDN.
 *  - assets/cover/ ELIMINADA. Las carátulas de los juegos en index.html
 *    usan Cloudinary con la transformación ar_16:9,c_fill,g_auto,w_1080.
 *  - _getMockupUrl(item): nueva función privada que construye la URL Cloudinary
 *    con la transformación correcta según el tag del producto:
 *      · Mobile → f_auto,q_auto,ar_9:20,c_fill,w_500
 *      · PC     → f_auto,q_auto,ar_16:9,c_fill,w_1200
 *  - openPreviewModal(): Phase 2 ahora usa _getMockupUrl() en lugar de
 *    CONFIG.wallpapersPath + item.file, garantizando que el mockup siempre
 *    recibe la versión optimizada para el marco del dispositivo.
 *  - getDownloadUrl() en app.js: la URL de descarga/email usa la estructura
 *    limpia https://res.cloudinary.com/dyspgn0sw/image/upload/{public_id}
 *    sin extensión ni parámetros de transformación, sirviendo el master original.
 *
 * NOVEDADES v9.4 (sincronización de versión con app.js):
 *  - Eliminado will-change estático en tarjetas del catálogo y biblioteca.
 *    El GPU-layer management ahora vive exclusivamente en CSS (hover :hover).
 *  - handleExport() refactorizado para usar window.MailHelper.copyToClipboard()
 *    en lugar de reimplementar el patrón navigator.clipboard + execCommand.
 *  - _noCtxHandler movido a variable de cierre del módulo (ya no muta el DOM).
 *  - btn-reset-filters escuchado vía JS en DOMContentLoaded (elimina onclick inline).
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
 *  - canvas-confetti    → window.confetti
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
 *  - resetFilters() es global (window) para compatibilidad con el onclick inline
 *    del botón "Ver todo el catálogo" en el HTML.
 */

// ── Estado del catálogo (módulo privado) ──────────────────────────────────────
let allItems     = [];
let activeFilter = 'NoObtenidos';
let searchQuery  = '';
let _pendingFilterFrame = null;
let _shopDelegationBound = false;
let _shopLazyObserver = null;
let _shopLazySentinel = null;
let _giftAutoplayTimer = null;
let _giftPauseUntil = 0;
let _giftCurrentIndex = 0;
let _giftSnapTimer = null;
if (typeof window.__laSessionGameCompleted === 'undefined') {
    let fromSession = false;
    try { fromSession = sessionStorage.getItem('la_session_game_completed') === '1'; } catch (_) { /* noop */ }
    window.__laSessionGameCompleted = fromSession;
}

/**
 * Estado de renderizado incremental del catálogo.
 * En lugar de pintar todos los ítems de una sola vez (costoso con catálogos
 * grandes), se montan en lotes bajo demanda al acercarse al final del grid.
 */
const _shopRenderState = {
    items: [],
    cursor: 0,
    batchSize: 18
};

function scheduleFilterItems() {
    if (_pendingFilterFrame !== null) cancelAnimationFrame(_pendingFilterFrame);
    _pendingFilterFrame = requestAnimationFrame(() => {
        _pendingFilterFrame = null;
        filterItems();
    });
}

// ── Handler de contextmenu para el mockup stage ──────────────────────────────
// Guardado como variable de módulo (no como propiedad del nodo DOM) para evitar
// la mutación de propiedades no-estándar en elementos del DOM y para poder
// hacer removeEventListener correctamente al cerrar el modal.
let _stageCtxHandler = null;

// ── Último elemento con foco antes de abrir un modal ─────────────────────────
// Se guarda en openXxxModal() y se restaura en _closeXxxModal() para que los
// usuarios de teclado no pierdan su posición en el flujo de la interfaz (WCAG 2.4.3).
let _lastFocusedElement = null;
let isRedeeming = false;

// ── Utilidad de iconos (v9.6 — SVG Sprite) ───────────────────────────────────
/**
 * [v11.5] refreshIcons() ha sido eliminada por obsolescencia.
 * Los iconos se sirven como SVG Sprite estático desde v9.6.
 * Esta referencia se mantiene solo si es estrictamente necesaria por compatibilidad externa,
 * pero ha sido vaciada y marcada para remoción.
 */
function refreshIcons() { /* deprecated */ }

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
    requestAnimationFrame(() => document.getElementById('modal-confirm').focus());
    return new Promise(resolve => { _modalResolve = resolve; });
}

function _closeModal(value) {
    document.getElementById('confirm-modal').classList.add('hidden');
    if (_modalResolve) { _modalResolve(value); _modalResolve = null; }
    // Restaurar foco al elemento que abrió el modal para no desorientar al usuario
    // de teclado (WCAG 2.4.3 — Focus Order).
    _lastFocusedElement?.focus();
    _lastFocusedElement = null;
}

// ── Wallpaper Preview Modal — Preview 2.0 (Dynamic Mockup) ───────────────────
//
// Replaces the static <img> preview with a 3-layer mockup frame:
//   Layer 1 (Art)        — CSS background-image (blocks "Save image as…")
//   Layer 2 (Protection) — pointer-events:none noise overlay
//   Layer 3 (UI)         — live clock + OS chrome (status bar / taskbar)
//
// Frame type is selected from item.tags:
//   "Mobile" → 9:20 portrait phone with status bar + 4×4 app grid
//   "PC"     → 16:9 landscape desktop with taskbar
//   (none)   → neutral 4:3 with watermark badge

let _mockupClockInterval = null;   // Cleared on modal close to prevent leaks
let _pendingHiResImg     = null;   // Tracks in-flight Image() load; cancelled on close
let _preloadObserver     = null;   // IntersectionObserver for hi-res smart preloading (v9.6)

/**
 * Resuelve el aspect ratio objetivo del preview.
 * Prioridad:
 *  1) Tag del item (Mobile=9:20, PC=16:9, Avatar=1:1).
 *  2) Dimensiones reales de la imagen (naturalWidth/naturalHeight) si existen.
 *  3) Fallback neutro 1:1.
 *
 * @param {object} item
 * @param {HTMLImageElement|null} [probeImg]
 * @returns {number} ratio ancho/alto
 */
function _resolvePreviewAspectRatio(item, probeImg = null) {
    const tags = Array.isArray(item?.tags) ? item.tags : [];
    // Reglas explícitas de negocio: el tag manda sobre cualquier metadato.
    if (tags.includes('Mobile')) return 9 / 20;
    if (tags.includes('PC')) return 16 / 9;
    if (tags.includes('Avatar')) return 1;

    // Solo si no hay tag reconocido, usar dimensión real del archivo.
    const w = Number(probeImg?.naturalWidth || 0);
    const h = Number(probeImg?.naturalHeight || 0);
    if (w > 0 && h > 0) return w / h;
    return 1;
}

/**
 * Ajusta tamaño de la caja de preview para respetar el aspect ratio indicado
 * sin exceder ni el ancho del stage ni el alto máximo visual (62vh).
 *
 * @param {HTMLElement} frameEl
 * @param {number} ratio  ancho/alto
 */
function _applyPreviewFrameSize(frameEl, ratio) {
    if (!frameEl) return;
    const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
    const stage     = document.getElementById('preview-mockup-stage');
    const maxW      = Math.max(220, (stage?.clientWidth || 520) - 40);
    const maxH      = Math.max(180, Math.floor(window.innerHeight * 0.62));

    // Fit "contain": primero por ancho, luego corregir por alto si excede.
    let width  = maxW;
    let height = width / safeRatio;
    if (height > maxH) {
        height = maxH;
        width  = height * safeRatio;
    }

    frameEl.style.width  = `${Math.round(width)}px`;
    frameEl.style.height = `${Math.round(height)}px`;
}

/**
 * Returns the current time as "HH:MM" using the device locale.
 * @returns {string}
 */
function _getMockupTimeString() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Updates every .mockup-clock-text / .mockup-pc-clock element in the active mockup.
 * Called once on open, then every 30 s via interval.
 */
function updateMockupTime() {
    const t = _getMockupTimeString();
    document.querySelectorAll('.mockup-clock-text, .mockup-pc-clock').forEach(el => {
        el.textContent = t;
    });
}

/**
 * Inline SVG icons for the mockup status bar, taskbar, and app grid.
 * All paths are pure geometry — no external requests, no Lucide dependency.
 */
const MOCKUP_SVG = {
    // ── Status bar / taskbar ──────────────────────────────────────────────────
    signal: `<svg width="12" height="11" viewBox="0 0 12 11" fill="currentColor" aria-hidden="true">
        <rect x="0" y="7" width="2.2" height="4" rx="0.6"/>
        <rect x="3.3" y="5" width="2.2" height="6" rx="0.6"/>
        <rect x="6.6" y="2.5" width="2.2" height="8.5" rx="0.6"/>
        <rect x="9.8" y="0" width="2.2" height="11" rx="0.6" opacity="0.32"/>
    </svg>`,

    wifi: `<svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor" aria-hidden="true">
        <circle cx="6" cy="9" r="1.15"/>
        <path d="M3.2 6.4a3.95 3.95 0 0 1 5.6 0l-.95.95a2.6 2.6 0 0 0-3.7 0z"/>
        <path d="M1 4.2a6.4 6.4 0 0 1 10 0l-.95.95a5.05 5.05 0 0 0-8.1 0z"/>
    </svg>`,

    battery: `<svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="16" height="9" rx="2.2" stroke="currentColor" stroke-width="1"/>
        <rect x="17" y="3" width="2.5" height="4" rx="1" fill="currentColor"/>
        <rect x="2" y="2" width="11" height="6" rx="1.2" fill="currentColor"/>
    </svg>`,

    arcadeLogo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="2" y="6" width="20" height="14" rx="3"/>
        <path d="M7 12h4M9 10v4"/>
        <circle cx="16" cy="12" r="1.2" fill="currentColor" stroke="none"/>
        <circle cx="13" cy="14" r="1.2" fill="currentColor" stroke="none" opacity="0.6"/>
        <path d="M8 3l1.5 3M16 3l-1.5 3"/>
    </svg>`,

    // Windows 11 Start button — four coloured squares arranged in a 2×2 grid
    winStart: `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1"  y="1"  width="6.5" height="6.5" rx="1.2" fill="rgba(255,255,255,0.92)"/>
        <rect x="8.5" y="1"  width="6.5" height="6.5" rx="1.2" fill="rgba(255,255,255,0.92)"/>
        <rect x="1"  y="8.5" width="6.5" height="6.5" rx="1.2" fill="rgba(255,255,255,0.92)"/>
        <rect x="8.5" y="8.5" width="6.5" height="6.5" rx="1.2" fill="rgba(255,255,255,0.92)"/>
    </svg>`,

    // ── App grid / desktop icons ──────────────────────────────────────────────
    // bg      → solid colour (reference only, no longer used in HTML)
    // bgAlpha → semi-transparent version: accent colour at 35% opacity +
    //           a white tint layer so the wallpaper always shows through.
    //           Value: rgba(R,G,B, 0.38) keeps the hue readable without
    //           blocking the image behind it.
    appIcons: [
        // 0 — Music
        { bg: '#1c0608', bgAlpha: 'rgba(252,60,68,0.35)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 15V5l8-2v10"/>
            <circle cx="4.5" cy="15" r="1.5" fill="white" stroke="none"/>
            <circle cx="12.5" cy="13" r="1.5" fill="white" stroke="none"/>
          </svg>` },
        // 1 — Camera
        { bg: '#1c1c1e', bgAlpha: 'rgba(80,80,90,0.40)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <path d="M2 6.5C2 5.7 2.7 5 3.5 5H5l1-2h6l1 2h1.5C15.3 5 16 5.7 16 6.5v7c0 .8-.7 1.5-1.5 1.5h-11C2.7 15 2 14.3 2 13.5z"/>
            <circle cx="9" cy="10" r="2.5"/>
          </svg>` },
        // 2 — Messages
        { bg: '#0a1f0e', bgAlpha: 'rgba(48,209,88,0.30)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 11.5c0 .8-.7 1.5-1.5 1.5H5.5L2 16V4.5C2 3.7 2.7 3 3.5 3h10C14.3 3 15 3.7 15 4.5z"/>
          </svg>` },
        // 3 — Phone
        { bg: '#0a1f0e', bgAlpha: 'rgba(48,209,88,0.30)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 3h3l1.5 3-1.8 1.1A9 9 0 0 0 10.9 11.3L12 9.5l3 1.5v3c0 .8-.7 1-1 1C6.8 15 3 10.2 3 4c0-.3.2-1 1-1z"/>
          </svg>` },
        // 4 — Mail
        { bg: '#02101f', bgAlpha: 'rgba(10,132,255,0.35)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="14" height="10" rx="1.5"/>
            <path d="M2 6l7 5 7-5"/>
          </svg>` },
        // 5 — Maps
        { bg: '#1f1200', bgAlpha: 'rgba(255,159,10,0.35)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 2C6.8 2 5 3.8 5 6c0 3.5 4 8 4 8s4-4.5 4-8c0-2.2-1.8-4-4-4z"/>
            <circle cx="9" cy="6" r="1.3" fill="white" stroke="none"/>
          </svg>` },
        // 6 — Photos
        { bg: '#1f0008', bgAlpha: 'rgba(255,55,95,0.32)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <rect x="2" y="3" width="14" height="12" rx="2"/>
            <circle cx="6.5" cy="7.5" r="1.5"/>
            <path d="M2 12l4-3.5 3 3 2.5-2 4.5 4"/>
          </svg>` },
        // 7 — Settings
        { bg: '#111113', bgAlpha: 'rgba(99,99,102,0.42)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="9" r="2.3"/>
            <path d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M4 4l1 1M13 13l1 1M4 14l1-1M13 5l1-1"/>
          </svg>` },
        // 8 — Calendar
        { bg: '#1f0200', bgAlpha: 'rgba(255,59,48,0.32)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <rect x="2.5" y="3.5" width="13" height="12" rx="2"/>
            <path d="M2.5 7.5h13"/>
            <path d="M6 2v3M12 2v3"/>
            <rect x="6" y="10" width="2" height="2" rx="0.4" fill="white" stroke="none"/>
          </svg>` },
        // 9 — Clock
        { bg: '#1c1c1e', bgAlpha: 'rgba(80,80,90,0.40)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <circle cx="9" cy="9" r="6.5"/>
            <path d="M9 5.5v4l2.5 2.5"/>
          </svg>` },
        // 10 — Calculator
        { bg: '#0d0d0e', bgAlpha: 'rgba(44,44,46,0.50)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <rect x="3" y="2.5" width="12" height="13" rx="2"/>
            <rect x="5" y="4.5" width="8" height="3" rx="0.8" fill="white" fill-opacity="0.3" stroke="none"/>
            <circle cx="6" cy="11" r="0.8" fill="white" stroke="none"/>
            <circle cx="9" cy="11" r="0.8" fill="white" stroke="none"/>
            <circle cx="12" cy="11" r="0.8" fill="white" stroke="none"/>
            <circle cx="6" cy="13.5" r="0.8" fill="white" stroke="none"/>
            <circle cx="9" cy="13.5" r="0.8" fill="white" stroke="none"/>
            <circle cx="12" cy="13.5" r="0.8" fill="white" stroke="none"/>
          </svg>` },
        // 11 — Notes
        { bg: '#1f1800', bgAlpha: 'rgba(255,214,10,0.30)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <rect x="3" y="2" width="12" height="14" rx="2"/>
            <path d="M6 6h6M6 9h6M6 12h4"/>
          </svg>` },
        // 12 — Podcast
        { bg: '#0e0519', bgAlpha: 'rgba(181,107,255,0.35)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <circle cx="9" cy="7" r="3"/>
            <path d="M5 11a5.4 5.4 0 0 0 8 0"/>
            <path d="M3 13.5a8 8 0 0 0 12 0"/>
            <line x1="9" y1="10" x2="9" y2="16"/>
          </svg>` },
        // 13 — Game
        { bg: '#041208', bgAlpha: 'rgba(48,209,88,0.28)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="5.5" width="14" height="9" rx="3"/>
            <path d="M6 8.5v3M4.5 10h3"/>
            <circle cx="11.5" cy="9.5" r="0.8" fill="white" stroke="none"/>
            <circle cx="13.5" cy="11.5" r="0.8" fill="white" stroke="none"/>
          </svg>` },
        // 14 — Wallet
        { bg: '#1f1200', bgAlpha: 'rgba(255,159,10,0.35)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <rect x="2" y="5" width="14" height="10" rx="2"/>
            <path d="M2 8h14"/>
            <circle cx="13" cy="12" r="1.2" fill="white" stroke="none"/>
          </svg>` },
        // 15 — Store
        { bg: '#001830', bgAlpha: 'rgba(10,132,255,0.35)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7h12l-1 7H4z"/>
            <path d="M1 4h16"/>
            <path d="M7 14v-4h4v4"/>
          </svg>` },
    ],

    // Labels shown under each desktop icon in the PC mockup
    appLabels: [
        'Music', 'Camera', 'Messages', 'Phone', 'Mail',
        'Maps', 'Photos', 'Settings', 'Calendar', 'Clock',
        'Calculator', 'Notes', 'Podcasts', 'Games', 'Wallet', 'Store',
    ],
};

/**
 * Applies a self-contained CSS fallback to the art layer when Cloudinary
 * is unreachable (network error, blocked CDN, CORS failure, etc.).
 *
 * The fallback uses a pure CSS gradient defined in styles.css
 * (.mockup-bg-offline) — zero external requests are made.
 *
 * Idempotent: safe to call from both Phase 1 (thumbProbe.onerror) and
 * Phase 2 (hiRes.onerror) without producing duplicate side-effects.
 *
 * @param {HTMLElement} artEl — .mockup-layer-art element inside #mockup-slot
 */
function _applyArtFallback(artEl) {
    if (!artEl || artEl.classList.contains('mockup-bg-offline')) return;
    artEl.style.backgroundImage = 'none';
    artEl.classList.remove('mockup-bg-loading', 'mockup-bg-ready');
    artEl.classList.add('mockup-bg-offline');
}

/**
 * Returns the Cloudinary URL for the mockup preview of an item.
 *
 * The transformation is chosen based on the item's tag so the crop
 * matches the target device frame:
 *   Mobile → 9:20 portrait, 500 px wide   (phone screen)
 *   PC     → 16:9 landscape, 1200 px wide  (desktop screen)
 *   Other  → falls back to the PC preset
 *
 * The public ID is derived from item.file by stripping the file extension,
 * keeping the URL independent of the original upload format (.webp/.jpg/.png).
 *
 * @param {object} item — shop item with .file and .tags[]
 * @returns {string}    — Cloudinary URL with the appropriate transformation
 */
function _getMockupUrl(item) {
    const CDN_BASE = 'https://res.cloudinary.com/dyspgn0sw/image/upload/';
    const tags     = Array.isArray(item.tags) ? item.tags : [];
    const base     = item.file.replace(/\.[^.]+$/, ''); // strip extension → public ID

    if (tags.includes('Mobile')) return `${CDN_BASE}f_auto,q_auto,ar_9:20,c_fill,w_500/${base}`;
    if (tags.includes('Avatar')) return `${CDN_BASE}f_auto,q_auto,ar_1:1,c_fill,w_800/${base}`;
    // PC o no etiquetado — 16:9 widescreen
    return `${CDN_BASE}f_auto,q_auto,ar_16:9,c_fill,w_1200/${base}`;
}

/**
 * Builds the 3-layer mockup HTML string for a given item.
 * @param {object} item  — shop item with .image and .tags[]
 * @returns {string}     — innerHTML for #mockup-slot
 */
function _buildMockupHTML(item) {
    const tags  = Array.isArray(item.tags) ? item.tags : [];
    const isMob = tags.includes('Mobile');
    const isPc  = tags.includes('PC');

    const now = _getMockupTimeString();

    // ── Frame class ───────────────────────────────────────────────────────────
    const frameClass = isMob ? 'mockup-mobile' : isPc ? 'mockup-pc' : 'mockup-fallback';

    // ── Layer 3 UI ────────────────────────────────────────────────────────────
    let uiHTML = '';

    if (isMob) {
        // 4×4 grid — all 16 named app icons.
        // Backgrounds are semi-transparent so the wallpaper bleeds through.
        const iconCells = MOCKUP_SVG.appIcons.map(app => `
            <div class="mockup-app-icon" style="background:${app.bgAlpha};">
                ${app.svg}
            </div>`).join('');

        uiHTML = `
            <div class="mockup-statusbar">
                <span class="mockup-clock-text">${now}</span>
                <div class="mockup-statusbar-icons">
                    ${MOCKUP_SVG.signal}
                    ${MOCKUP_SVG.wifi}
                    ${MOCKUP_SVG.battery}
                </div>
            </div>
            <div class="mockup-app-area">
                <div class="mockup-app-grid">${iconCells}</div>
            </div>
            <div class="mockup-home-indicator"></div>`;

    } else if (isPc) {
        // Left column: 6 small desktop shortcuts, Windows-style.
        // Only 6 icons in a single column hugging the left edge.
        // The wallpaper dominates the frame; OS feel from chrome, not coverage.
        const desktopIcons = MOCKUP_SVG.appIcons.slice(0, 6).map((app, i) => `
            <div class="mockup-desktop-icon">
                <div class="mockup-desktop-icon-img" style="background:${app.bgAlpha};">
                    ${app.svg}
                </div>
                <span class="mockup-desktop-label">${MOCKUP_SVG.appLabels[i]}</span>
            </div>`).join('');

        // Taskbar centre: 6 pinned app icons (icons 6-11)
        const pinnedApps = MOCKUP_SVG.appIcons.slice(6, 12).map(app => `
            <div class="mockup-taskbar-pinned" style="background:${app.bgAlpha};">
                ${app.svg}
            </div>`).join('');

        uiHTML = `
            <div class="mockup-desktop-area">
                <div class="mockup-desktop-shortcuts">${desktopIcons}</div>
            </div>
            <div class="mockup-taskbar">
                <div class="mockup-taskbar-left">
                    <div class="mockup-taskbar-start">
                        ${MOCKUP_SVG.winStart}
                    </div>
                    <div class="mockup-taskbar-search">
                        <svg viewBox="0 0 12 12" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.3" stroke-linecap="round"><circle cx="5" cy="5" r="3"/><line x1="7.5" y1="7.5" x2="10" y2="10"/></svg>
                    </div>
                </div>
                <div class="mockup-taskbar-centre">
                    ${pinnedApps}
                </div>
                <div class="mockup-taskbar-right">
                    ${MOCKUP_SVG.wifi}
                    ${MOCKUP_SVG.battery}
                    <span class="mockup-pc-clock">${now}</span>
                </div>
            </div>`;

    } else {
        uiHTML = `
            <div class="mockup-fallback-watermark">
                ${MOCKUP_SVG.arcadeLogo}
            </div>`;
    }

    return `
        <div class="mockup-container ${frameClass}">
            <div class="mockup-layer-art" aria-hidden="true"></div>
            <div class="mockup-layer-protection" aria-hidden="true"></div>
            <div class="mockup-layer-ui">
                ${uiHTML}
            </div>
        </div>`;
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

    const url = _getMockupUrl(item);
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
 * Crea (o recrea) el IntersectionObserver de precarga.
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
 * Idempotente: si _preloadObserver ya existe la desconecta y cancela la cola
 * pendiente antes de crear una nueva (necesario tras renderShop()).
 *
 * Solo observa tarjetas de items NO comprados (identificadas por .shop-preview-btn).
 *
 * @param {HTMLElement} container — #shop-container con las tarjetas ya en el DOM.
 * @param {object[]}    items     — Arreglo de items en el mismo orden del DOM.
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

    // Degradación elegante: entornos sin soporte (browsers muy antiguos, SSR)
    if (!('IntersectionObserver' in window)) return;

    // Respetar preferencia de ahorro de datos del usuario.
    // En slow-2g o Data Saver, cualquier precarga consumiría recursos que el
    // usuario explícitamente quiere conservar.
    if (_isDataSaverActive()) return;

    // Construir mapa id → item para O(1) lookup en el callback
    const itemMap = new Map(items.map(it => [it.id, it]));

    _preloadObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const cardEl = entry.target;

            // Si ya fue procesado en un ciclo anterior, solo dejar de observar
            if (cardEl.dataset.preloaded) {
                _preloadObserver?.unobserve(cardEl);
                return;
            }

            // Resolver item desde el data-id del botón de preview
            const previewBtn = cardEl.querySelector('.shop-preview-btn');
            const rawId      = previewBtn?.dataset?.id;
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

    container.querySelectorAll('.shop-card').forEach(card => {
        if (card.querySelector('.shop-preview-btn')) {
            _preloadObserver.observe(card);
        }
    });
}

/**
 * Opens the preview modal with the dynamic mockup for the given item.
 * Handles clock updates, context-menu blocking, and action buttons.
 *
 * Accepts either the full item object (from renderShop event listeners)
 * or a numeric item ID (from dynamically generated onclick="" strings).
 * When an ID is passed, the item is resolved from allItems[].
 *
 * CAMBIO v9.8 — Apertura en dos fases para eliminar freeze en gama baja:
 *   Fase síncrona  (<1 ms):  mostrar modal + renderizar botones de acción.
 *   Fase diferida  (rAF):    _buildMockupHTML() + carga de imágenes.
 * Esto garantiza que la animación modalPopIn arranca en el primer frame
 * (<16 ms) antes de que el trabajo pesado comience.
 *
 * @param {object|number|string} itemOrId  Full item object OR item ID (any type).
 */
function openPreviewModal(itemOrId) {
    // ── Resolve item ──────────────────────────────────────────────────────────
    // Number() safely converts strings like "5" → 5; leaves NaN for non-numeric.
    // We treat non-object input as an ID regardless of JS type, so there is no
    // silent failure from strict === comparison between String("5") and Number(5).
    let item;
    if (itemOrId !== null && typeof itemOrId === 'object') {
        item = itemOrId;                                   // Already a full object
    } else {
        const numId = Number(itemOrId);                    // "5" → 5, 5 → 5
        item = allItems.find(i => i.id === numId);
    }

    if (!item) {
        console.warn('[Preview 2.0] openPreviewModal: item not found for', itemOrId,
            '| allItems loaded:', allItems.length);
        return;
    }

    const modal     = document.getElementById('preview-modal');
    const slot      = document.getElementById('mockup-slot');
    const nameEl    = document.getElementById('preview-name');
    const actionsEl = document.getElementById('preview-actions');
    const eco       = window.ECONOMY;

    // Null-guard: modal must exist in the DOM (index.html #preview-mockup-stage)
    if (!modal || !slot) {
        console.error('[Preview 2.0] Required DOM elements not found: #preview-modal or #mockup-slot');
        return;
    }

    // ── v9.8: Apertura instantánea — mostrar el modal ANTES de construir el mockup
    //
    // Problema original: _buildMockupHTML() genera ~16 SVG inline + los 3 layers del
    // mockup de forma síncrona. En gama baja esto bloquea el hilo principal 50–150 ms
    // ANTES de que el modal sea visible, por lo que la animación de entrada (modalPopIn)
    // nunca llega a renderizar su frame inicial — el usuario percibe un "freeze" y
    // luego el modal aparece ya en su posición final.
    //
    // Solución: separar la apertura visual (instant, <1 ms) del trabajo pesado de DOM.
    //   1. Mostrar el modal inmediatamente → el browser pinta el overlay + modalPopIn
    //      en el siguiente frame, dando respuesta visual <16 ms.
    //   2. Diferir todo el trabajo pesado (buildMockupHTML + image loading) al siguiente
    //      requestAnimationFrame. En ese punto el overlay ya está en pantalla y el
    //      usuario ve movimiento, eliminando la sensación de freeze.
    //
    // El name se actualiza de forma síncrona porque es texto puro (<1 ms).
    nameEl.textContent = item.name;

    // Limpiar slot antes de abrir para evitar que se vea contenido del modal anterior
    // durante el primer frame. innerHTML = '' es más barato que _buildMockupHTML.
    slot.innerHTML = '';

    // Registrar foco y abrir modal ANTES del trabajo pesado (v9.8).
    _lastFocusedElement = document.activeElement;
    modal.classList.remove('hidden');

    // Analítica — view_preview: se dispara en fase síncrona, antes del rAF,
    // para garantizar el registro incluso si el usuario cierra rápidamente.
    window.GhostAnalytics?.track('view_preview', {
        wallpaper: item.name,
        categoria: Array.isArray(item.tags) && item.tags.length ? item.tags[0] : 'General'
    });

    // Preview simplificado (sin mockups Mobile/PC) para minimizar nodos y trabajo JS.
    // Mantiene una capa visual de protección y bloqueo contextual para dificultar
    // extracción directa, pero elimina UI superpuesta no esencial.
    slot.innerHTML = `
        <div class="preview-art-frame">
            <div class="preview-art-layer mockup-layer-art" aria-hidden="true"></div>
            <div class="preview-art-protection" aria-hidden="true"></div>
        </div>`;

    const wallpaperPath = _getMockupUrl(item);
    const artEl         = slot.querySelector('.preview-art-layer');
    const frameEl       = slot.querySelector('.preview-art-frame');

    // Tamaño inicial inmediato usando heurística por tags.
    _applyPreviewFrameSize(frameEl, _resolvePreviewAspectRatio(item));

    artEl.style.backgroundImage = `url('${item.image}')`;
    artEl.classList.add('mockup-bg-loading');

    if (_pendingHiResImg) { _pendingHiResImg.onload = _pendingHiResImg.onerror = null; _pendingHiResImg = null; }

    let _thumbOk = false;
    const thumbProbe = new Image();
    thumbProbe.decoding = 'async';
    thumbProbe.onload = () => {
        _thumbOk = true;
        // Refinar el tamaño con el aspect ratio REAL de la imagen.
        _applyPreviewFrameSize(frameEl, _resolvePreviewAspectRatio(item, thumbProbe));
    };
    thumbProbe.onerror = () => {
        if (_pendingHiResImg) {
            _pendingHiResImg.onload = _pendingHiResImg.onerror = null;
            _pendingHiResImg = null;
        }
        _applyArtFallback(artEl);
    };
    thumbProbe.src = item.image;

    const hiRes = new Image();
    _pendingHiResImg = hiRes;
    hiRes.decoding = 'async';
    hiRes.onload = () => {
        if (_pendingHiResImg !== hiRes) return;
        artEl.style.backgroundImage = `url('${wallpaperPath}')`;
        artEl.classList.remove('mockup-bg-loading');
        artEl.classList.add('mockup-bg-ready');
        _pendingHiResImg = null;
    };
    hiRes.onerror = () => {
        if (_pendingHiResImg !== hiRes) return;
        _pendingHiResImg = null;
        if (_thumbOk) {
            artEl.classList.remove('mockup-bg-loading');
            artEl.classList.add('mockup-bg-ready');
        } else {
            _applyArtFallback(artEl);
        }
    };
    hiRes.src = wallpaperPath;

    // ── Anti-extraction: contextmenu hardening ────────────────────────────────
    const stage = document.getElementById('preview-mockup-stage');
    if (!_stageCtxHandler) _stageCtxHandler = (e) => { e.preventDefault(); };
    stage.removeEventListener('contextmenu', _stageCtxHandler);
    stage.addEventListener('contextmenu', _stageCtxHandler);
    slot.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); return false; };

    // ── Action buttons ────────────────────────────────────────────────────────
    // Se construyen de forma síncrona porque son DOM mínimo (2 botones) y
    // necesitan estar listos para el foco inmediatamente al abrir el modal.
    const isOwned    = GameCenter.getBoughtCount(item.id) > 0;
    const finalPrice = eco.isSaleActive ? Math.floor(item.price * eco.saleMultiplier) : item.price;

    if (isOwned) {
        const url = GameCenter.getDownloadUrl(item.id, item.file);
        actionsEl.innerHTML = url
            ? `<a href="${url}" download class="btn-primary vault-btn" style="flex:1; justify-content:center;">
                   <svg class="icon" width="14" height="14" aria-hidden="true"><use href="#icon-download"></use></svg> Descargar
               </a>`
            : `<button class="btn-primary" style="flex:1; justify-content:center; opacity:0.5;" disabled>
                   <svg class="icon" width="14" height="14" aria-hidden="true"><use href="#icon-check"></use></svg> Obtenido
               </button>`;
        actionsEl.innerHTML +=
            `<button class="btn-ghost" style="flex:1; justify-content:center;" id="preview-close-btn">Volver</button>`;

        // Analítica — click_download (fuente: vista previa)
        actionsEl.querySelector('a[download]')?.addEventListener('click', () => {
            window.GhostAnalytics?.track('click_download', {
                wallpaper: item.name,
                fuente: 'preview'
            });
        });
    } else {
        actionsEl.innerHTML =
            `<button class="btn-ghost" style="flex:1; justify-content:center;" id="preview-close-btn">Volver</button>
             <button class="btn-primary preview-buy-btn" style="flex:2; justify-content:center;"
                     data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                 <svg class="icon" width="13" height="13" style="fill:#fbbf24;stroke:none" aria-hidden="true"><use href="#icon-star"></use></svg>
                 Canjear · ${finalPrice}
             </button>`;
    }

    // Mover foco al botón de cierre para accesibilidad (WCAG 2.4.3).
    // Segundo rAF: esperar al frame posterior al que ya muestra el modal para
    // que el botón sea interactivo antes de hacer focus().
    requestAnimationFrame(() => {
        document.getElementById('preview-close-btn')?.focus()
            ?? document.getElementById('preview-close')?.focus();
    });
    refreshIcons(actionsEl);

    actionsEl.querySelector('.preview-buy-btn')?.addEventListener('click', async () => {
        closePreviewModal();
        const parsed = JSON.parse(
            actionsEl.querySelector('.preview-buy-btn').dataset.item.replace(/&#39;/g, "'")
        );
        await initiatePurchase(parsed, null);
    });

    document.getElementById('preview-close-btn')?.addEventListener('click', () => {
        closePreviewModal();
    });
}

/**
 * Closes the preview modal and performs full resource cleanup:
 *  - Cancels any in-flight high-res image load (prevents stale onload callbacks)
 *  - Clears background-image on the art layer → frees GPU texture buffer
 *  - Clears the clock interval
 *  - Removes the contextmenu blocker from the stage
 *
 * [v9.6 Phase 3] will-change ya no se gestiona aquí. Está declarado en CSS
 * sobre .modal-box y se libera automáticamente cuando el overlay recibe
 * display:none via .hidden (el navegador descarta la capa compuesta).
 *
 * Public — no arguments needed (resolves DOM refs internally).
 * Also accepts optional explicit refs for internal callers (unchanged API).
 *
 * @param {HTMLElement} [modal]  Defaults to #preview-modal.
 * @param {HTMLElement} [stage]  Defaults to #preview-mockup-stage.
 */
function closePreviewModal(modal, stage) {
    const m    = modal || document.getElementById('preview-modal');
    const s    = stage || document.getElementById('preview-mockup-stage');
    const slot = document.getElementById('mockup-slot');

    // ── Cancel in-flight HiRes load ───────────────────────────────────────────
    if (_pendingHiResImg) {
        _pendingHiResImg.onload = _pendingHiResImg.onerror = null;
        _pendingHiResImg = null;
    }

    // ── GPU memory flush: clear art layer background-image ────────────────────
    // Setting to 'none' immediately releases the decoded texture from the GPU
    // buffer, which is critical on <2GB RAM devices where large images stay
    // resident as long as they are referenced in the DOM.
    const artEl = slot?.querySelector('.mockup-layer-art');
    if (artEl) {
        artEl.style.backgroundImage = 'none';
        artEl.classList.remove('mockup-bg-loading', 'mockup-bg-ready');
    }

    // ── Remove slot contextmenu blocker ───────────────────────────────────────
    if (slot) slot.oncontextmenu = null;

    // ── Ocultar modal — la capa compuesta se libera automáticamente ───────────
    // .hidden aplica display:none, lo que destruye la capa GPU creada por
    // will-change:opacity,transform declarado en .modal-box (CSS). No es
    // necesario m.style.willChange = 'auto'.
    if (m) { m.classList.add('hidden'); }

    // ── Clock interval ────────────────────────────────────────────────────────
    if (_mockupClockInterval) { clearInterval(_mockupClockInterval); _mockupClockInterval = null; }

    // ── Stage contextmenu listener ────────────────────────────────────────────
    if (s && _stageCtxHandler) {
        s.removeEventListener('contextmenu', _stageCtxHandler);
    }

    // ── Restaurar foco al elemento que abrió la vista previa (WCAG 2.4.3) ────
    _lastFocusedElement?.focus();
    _lastFocusedElement = null;
}

// Private alias kept for internal callers that pass explicit refs (unchanged API)
const _closePreviewModal = closePreviewModal;

// ── Global exposure ───────────────────────────────────────────────────────────
// Required for:
//   (a) onclick="openPreviewModal(...)" in dynamically generated HTML strings
//   (b) onclick="closePreviewModal()" in modal action buttons
//   (c) any game module or external script calling the preview API
window.openPreviewModal  = openPreviewModal;
window.closePreviewModal = closePreviewModal;

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.shop-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === tab)
    );
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    const panel = document.getElementById(`tab-${tab}`);
    panel.classList.remove('hidden');

    if (tab === 'settings') {
        renderHistory();
        renderMoonBlessingStatus();
        renderStreakCalendar();
    }
    // Scope al panel activo: evita re-escanear vistas ocultas de la SPA.
    refreshIcons(panel);
}

function _isGiftItem(item) {
    return item?.category === 'gift' || (Array.isArray(item?.tags) && item.tags.includes('regalo'));
}

function _isGiftUnlocked(item) {
    const reqType = item?.requirements?.type;
    if (reqType === 'game_played') {
        const byWindow = Boolean(window.__laSessionGameCompleted);
        let bySession = false;
        try { bySession = sessionStorage.getItem('la_session_game_completed') === '1'; } catch (_) { /* noop */ }
        return byWindow || bySession;
    }
    return false;
}

function _getGiftRequirementText(item) {
    return item?.requirements?.description || 'Completa 1 partida';
}

function _readGiftClaimOrder() {
    try {
        const raw = sessionStorage.getItem('la_gift_claim_order');
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.filter(v => Number.isFinite(v)) : [];
    } catch (_) {
        return [];
    }
}

function _writeGiftClaimOrder(order) {
    try {
        sessionStorage.setItem('la_gift_claim_order', JSON.stringify(order.slice(-30)));
    } catch (_) { /* noop */ }
}

function _rememberGiftClaim(itemId) {
    const prev = _readGiftClaimOrder().filter(id => id !== itemId);
    prev.push(itemId);
    _writeGiftClaimOrder(prev);
}

function _buildGiftFocus(items) {
    const owned = items.filter(item => window.GameCenter.getBoughtCount(item.id) > 0);
    const pending = items.filter(item => window.GameCenter.getBoughtCount(item.id) === 0);
    const claimedOrder = _readGiftClaimOrder();

    const recentOwned = [];
    for (let i = claimedOrder.length - 1; i >= 0 && recentOwned.length < 2; i -= 1) {
        const found = owned.find(item => item.id === claimedOrder[i]);
        if (found && !recentOwned.some(x => x.id === found.id)) recentOwned.push(found);
    }
    if (recentOwned.length < 2) {
        const byIdDesc = owned.slice().sort((a, b) => b.id - a.id);
        byIdDesc.forEach(item => {
            if (recentOwned.length >= 2) return;
            if (!recentOwned.some(x => x.id === item.id)) recentOwned.push(item);
        });
    }

    const focus = [...pending, ...recentOwned].slice(0, 6);
    const focusSet = new Set(focus.map(item => item.id));
    const collection = owned.filter(item => !focusSet.has(item.id));
    return { focus, collection, ownedTotal: owned.length };
}

function _stopGiftAutoplay() {
    if (_giftAutoplayTimer) {
        clearInterval(_giftAutoplayTimer);
        _giftAutoplayTimer = null;
    }
}

function _updateGiftFilterGlow() {
    const giftBtn = document.querySelector('.filter-btn-gift');
    if (!giftBtn || !allItems.length) return;
    const hasUnclaimed = allItems.some(item =>
        _isGiftItem(item) && _isGiftUnlocked(item) && window.GameCenter.getBoughtCount(item.id) === 0
    );
    giftBtn.classList.toggle('has-unclaimed', hasUnclaimed);
}

function _advanceGiftCarousel(step = 1) {
    const track = document.getElementById('gift-carousel-track');
    if (!track) return;
    const cards = Array.from(track.querySelectorAll('.gift-card'));
    if (!cards.length) return;
    const next = _giftCurrentIndex + step;
    if (next >= cards.length) {
        _giftCurrentIndex = cards.length - 1;
        return;
    }
    _giftCurrentIndex = Math.max(0, next);
    cards[_giftCurrentIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
}

function _initGiftAutoplay() {
    _stopGiftAutoplay();
    _giftAutoplayTimer = setInterval(() => {
        if (Date.now() < _giftPauseUntil) return;
        _advanceGiftCarousel(1);
    }, 3800);
}

function _renderGiftCarousel(items) {
    const track = document.getElementById('gift-carousel-track');
    const collectionToggle = document.getElementById('gift-collection-toggle');
    const collectionGrid = document.getElementById('gift-collection-grid');
    if (!track) return;
    _stopGiftAutoplay();
    track.innerHTML = '';
    if (collectionGrid) collectionGrid.innerHTML = '';
    if (!items.length) return;

    const { focus, collection, ownedTotal } = _buildGiftFocus(items);
    const focusItems = focus.length ? focus : items.slice(0, 1);
    const unownedIndex = focusItems.findIndex(item => window.GameCenter.getBoughtCount(item.id) === 0);
    _giftCurrentIndex = unownedIndex >= 0 ? unownedIndex : 0;

    const html = focusItems.map(item => {
        const unlocked = _isGiftUnlocked(item);
        const owned = window.GameCenter.getBoughtCount(item.id) > 0;
        const ctaText = 'Descargar';
        const disabled = !owned && !unlocked ? 'disabled' : '';
        const opacity = !owned && !unlocked ? ' style="opacity:.5"' : '';
        return `<article class="gift-card" data-gift-id="${item.id}">
            <img src="${item.image}" alt="${item.name}" loading="lazy" decoding="async"
                 onerror="this.onerror=null; this.classList.add('shop-img--offline'); this.removeAttribute('src');">
            ${owned ? `<span class="gift-owned-badge">${_icon('check', 11)} Obtenido</span>` : ''}
            <h3 class="gift-card-name">${item.name}</h3>
            <span class="gift-pill gift-pill--req">${_getGiftRequirementText(item)}</span>
            <button class="gift-pill gift-pill--cta" data-gift-action="${item.id}" ${disabled}${opacity}>${ctaText}</button>
        </article>`;
    }).join('');

    track.innerHTML = html;
    if (collectionToggle) {
        collectionToggle.textContent = `Ver mi colección completa (${ownedTotal} totales)`;
        collectionToggle.classList.toggle('hidden', collection.length === 0);
        collectionToggle.setAttribute('aria-expanded', 'false');
    }
    if (collectionGrid) {
        collectionGrid.classList.add('hidden');
        collectionGrid.innerHTML = collection.map(item =>
            `<article class="gift-collection-item" title="${item.name}">
                <img src="${item.image}" alt="${item.name}" loading="lazy" decoding="async"
                     onerror="this.onerror=null; this.classList.add('shop-img--offline'); this.removeAttribute('src');">
            </article>`
        ).join('');
    }

    requestAnimationFrame(() => {
        const cards = track.querySelectorAll('.gift-card');
        cards[_giftCurrentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    });

    if (!track.dataset.boundScrollPause) {
        track.dataset.boundScrollPause = '1';
        track.addEventListener('scroll', () => {
            _giftPauseUntil = Date.now() + 10000;
            if (_giftSnapTimer) clearTimeout(_giftSnapTimer);
            _giftSnapTimer = setTimeout(() => {
                const cards = Array.from(track.querySelectorAll('.gift-card'));
                if (!cards.length) return;
                let nearest = 0;
                let minDist = Number.POSITIVE_INFINITY;
                cards.forEach((card, idx) => {
                    const dist = Math.abs(card.offsetLeft - track.scrollLeft);
                    if (dist < minDist) { minDist = dist; nearest = idx; }
                });
                _giftCurrentIndex = nearest;
                cards[nearest]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
            }, 120);
        }, { passive: true });
    }

    _initGiftAutoplay();
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function filterItems() {
    if (!allItems.length) return;
    const gridEl      = document.getElementById('shop-container');
    const giftEl      = document.getElementById('gift-carousel');
    const countEl     = document.getElementById('search-results-count');
    const emptyEl     = document.getElementById('filter-empty');

    const filtered = allItems.filter(item => {
        const isGift = _isGiftItem(item);
        let matchesFilter;
        if      (activeFilter === 'Todos')       matchesFilter = !isGift;
        else if (activeFilter === 'NoObtenidos') matchesFilter = !isGift && GameCenter.getBoughtCount(item.id) === 0;
        else if (activeFilter === 'Regalos')     matchesFilter = isGift;
        else                                     matchesFilter = Array.isArray(item.tags) && item.tags.includes(activeFilter);

        const matchesSearch = !searchQuery
            || item.name.toLowerCase().includes(searchQuery)
            || (item.desc || '').toLowerCase().includes(searchQuery)
            || (Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase().includes(searchQuery)));

        return matchesFilter && matchesSearch;
    });

    if (activeFilter === 'Regalos') {
        gridEl?.classList.add('hidden');
        giftEl?.classList.remove('hidden');
        _renderGiftCarousel(filtered);
    } else {
        giftEl?.classList.add('hidden');
        renderShop(filtered);
    }

    const sorted  = filtered;

    if (sorted.length === 0 && activeFilter === 'NoObtenidos' && !searchQuery) {
        renderShop(allItems);
        gridEl.classList.remove('hidden');
        giftEl?.classList.add('hidden');
        emptyEl.classList.add('hidden');
        countEl.textContent = 'No hay novedades pendientes';
        countEl.classList.remove('hidden');
    } else if (sorted.length === 0) {
        gridEl.classList.add('hidden');
        giftEl?.classList.add('hidden');
        emptyEl.classList.remove('hidden');
        countEl.classList.add('hidden');
    } else {
        if (activeFilter !== 'Regalos') gridEl.classList.remove('hidden');
        emptyEl.classList.add('hidden');
        const isFiltered = activeFilter !== 'Todos' || searchQuery;
        countEl.textContent = isFiltered ? `${sorted.length} resultado${sorted.length !== 1 ? 's' : ''}` : '';
        countEl.classList.toggle('hidden', !isFiltered);
    }

    _updateGiftFilterGlow();
}

function resetFilters() {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-filter="NoObtenidos"]').classList.add('active');
    activeFilter = 'NoObtenidos';
    searchQuery  = '';
    const searchInput = document.getElementById('search-input');
    const clearBtn    = document.getElementById('search-clear');
    if (searchInput) searchInput.value = '';
    if (clearBtn)    clearBtn.classList.add('hidden');
    scheduleFilterItems();
}
// Exponer globalmente (compatible con onclick="resetFilters()" en el HTML)
window.resetFilters = resetFilters;

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

function _buildShopCard(item) {
    const bought     = GameCenter.getBoughtCount(item.id);
    const isOwned    = bought > 0;
    const eco        = window.ECONOMY;
    const finalPrice = eco.isSaleActive ? Math.floor(item.price * eco.saleMultiplier) : item.price;

    const priceHTML = eco.isSaleActive && !isOwned
        ? `<div class="shop-price">
               <span class="price-original">${item.price}</span>
               <svg class="icon" width="11" height="11" style="fill:#fbbf24;stroke:none" aria-hidden="true"><use href="#icon-star"></use></svg>
               <span class="price-sale">${finalPrice}</span>
           </div>`
        : `<div class="shop-price">
               <svg class="icon" width="11" height="11" style="fill:#fbbf24;stroke:none" aria-hidden="true"><use href="#icon-star"></use></svg>
               ${isOwned ? '<span style="color:var(--success);">Obtenido</span>' : item.price}
           </div>`;

    const actionHTML = isOwned
        ? (() => {
            const url = GameCenter.getDownloadUrl(item.id, item.file);
            return url
                ? `<a href="${url}" download class="btn-primary vault-btn"
                       style="width:100%; justify-content:center; font-size:0.78rem; padding:7px;">
                       <svg class="icon" width="13" height="13" aria-hidden="true"><use href="#icon-download"></use></svg> Descargar
                   </a>`
                : `<button class="btn-primary"
                       style="width:100%; justify-content:center; opacity:0.5; font-size:0.78rem; padding:7px;"
                       disabled>
                       <svg class="icon" width="13" height="13" aria-hidden="true"><use href="#icon-check"></use></svg> Obtenido
                   </button>`;
        })()
        : `<div style="display:flex; gap:5px; width:100%;">
                <button class="btn-ghost shop-preview-btn"
                        style="flex-shrink:0; padding:7px 9px;"
                        data-id="${item.id}" title="Vista previa">
                    <svg class="icon" width="13" height="13" aria-hidden="true"><use href="#icon-eye"></use></svg>
                </button>
                <button class="btn-primary shop-buy-btn"
                        style="flex:1; justify-content:center; font-size:0.78rem; padding:7px;"
                        data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                    <svg class="icon" width="11" height="11" style="fill:#fbbf24;stroke:none" aria-hidden="true"><use href="#icon-star"></use></svg> ${finalPrice}
                </button>
           </div>`;

    const card = document.createElement('article');
    card.className = 'glass-panel shop-card';
    card.innerHTML =
        `        <img src="${item.image}" alt="${item.name}" class="shop-img" loading="lazy" decoding="async"
             onerror="this.onerror=null; this.classList.add('shop-img--offline'); this.removeAttribute('src');">
        ${isOwned ? '<div class="owned-badge"><svg class="icon" width="10" height="10" aria-hidden="true"><use href="#icon-check-circle-2"></use></svg> Tuyo</div>' : ''}
        ${eco.isSaleActive && !isOwned
            ? '<div class="sale-card-badge"><svg class="icon" width="9" height="9" style="fill:currentColor;stroke:none" aria-hidden="true"><use href="#icon-zap"></use></svg> OFERTA</div>'
            : ''}
        <div style="width:100%;">
            <h3 class="card-name">${item.name}</h3>
            ${priceHTML}
            ${actionHTML}
        </div>`;
    return card;
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

    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i += 1) frag.appendChild(_buildShopCard(_shopRenderState.items[i]));
    if (_shopLazySentinel && _shopLazySentinel.parentElement === container) {
        container.insertBefore(frag, _shopLazySentinel);
    } else {
        container.appendChild(frag);
    }
    _shopRenderState.cursor = end;

    refreshIcons(container);
    _initPreloadObserver(container, _shopRenderState.items.slice(0, end));
    return end < _shopRenderState.items.length;
}

// ── Render: Catálogo (lazy incremental mounting) ─────────────────────────────
function renderShop(items) {
    const container = document.getElementById('shop-container');
    _teardownShopLazyRender();
    container.innerHTML = '';

    _shopRenderState.items  = items;
    _shopRenderState.cursor = 0;

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

    container.addEventListener('click', async (e) => {

        const previewBtn = e.target.closest('.shop-preview-btn');
        if (previewBtn) {
            const item = allItems.find(i => i.id === parseInt(previewBtn.dataset.id, 10));
            if (item) openPreviewModal(item);
            return;
        }

        const buyBtn = e.target.closest('.shop-buy-btn');
        if (buyBtn) {
            try {
                const item = JSON.parse(buyBtn.dataset.item.replace(/&#39;/g, "'"));
                await initiatePurchase(item, buyBtn);
            } catch (err) {
                console.error('Error parsing item', err);
            }
        }
    });
}

async function _handleGiftAction(itemId) {
    const item = allItems.find(i => i.id === itemId && _isGiftItem(i));
    if (!item) return;

    const owned = window.GameCenter.getBoughtCount(item.id) > 0;
    if (!owned && !_isGiftUnlocked(item)) {
        showToast('Completa una partida para desbloquear este regalo.', 'warning');
        return;
    }

    if (!owned) {
        const result = window.GameCenter.buyItem(item);
        if (!result?.success) {
            showToast('No se pudo reclamar el regalo ahora mismo.', 'error');
            return;
        }
        _rememberGiftClaim(item.id);
        showToast('¡Gracias por jugar hoy! Tu apoyo mantiene este mundo vivo.', 'success');
        window.GhostAnalytics?.track('gift_claimed', { item: item.name, requirement: item.requirements?.type || 'unknown' });
    }

    const url = window.GameCenter.getDownloadUrl(item.id, item.file);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.GhostAnalytics?.track('click_download', { wallpaper: item.name, fuente: 'gift_carousel' });
    filterItems();
    renderLibrary(allItems);
}

// ── Render: Biblioteca ────────────────────────────────────────────────────────
function renderLibrary(items) {
    const container = document.getElementById('library-container');
    const inventory = GameCenter.getInventory();
    const owned     = items.filter(item => inventory[item.id] > 0);

    if (owned.length === 0) {
        container.innerHTML =
            `<div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text-low);">
                <svg class="icon" width="40" height="40" aria-hidden="true"><use href="#icon-archive"></use></svg>
                <p style="font-family:var(--font-display); font-size:1rem; font-weight:700; color:var(--text-med);">Tu biblioteca está vacía</p>
                <p style="font-size:0.8rem; margin-top:6px;">Canjea wallpapers en el Catálogo.</p>
            </div>`;
        refreshIcons(container); // scope al contenedor vacío
        return;
    }

    container.innerHTML = '';
    owned.forEach(item => {
        const url  = GameCenter.getDownloadUrl(item.id, item.file);
        const card = document.createElement('article');
        card.className     = 'glass-panel shop-card';
        // will-change gestionado por CSS (:hover), no en JS (ver renderShop)

        const actionsHTML = url
            ? `<div style="display:flex; gap:5px; width:100%; margin-top:8px;">
                   <a href="${url}" download
                      class="btn-primary vault-btn"
                      style="flex:1; justify-content:center; font-size:0.78rem; padding:7px;">
                       <svg class="icon" width="13" height="13" aria-hidden="true"><use href="#icon-download"></use></svg> Descargar
                   </a>
                   <button class="btn-mail library-mail-btn"
                           data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'
                           data-url="${url}"
                           aria-label="Enviar enlace de descarga por correo para ${item.name.replace(/"/g, '&quot;')}"
                           title="Enviar por correo">
                       <svg class="icon" width="13" height="13" aria-hidden="true"><use href="#icon-send"></use></svg>
                   </button>
               </div>`
            : `<button class="btn-primary"
                       style="margin-top:8px; width:100%; justify-content:center; opacity:0.5; font-size:0.78rem; padding:7px;"
                       disabled>
                   <svg class="icon" width="13" height="13" aria-hidden="true"><use href="#icon-check"></use></svg> Sin archivo
               </button>`;

        card.innerHTML =
            `<img src="${item.image}" alt="${item.name}" class="shop-img" loading="lazy"
                  onerror="this.onerror=null; this.classList.add('shop-img--offline'); this.removeAttribute('src');">
            <div class="owned-badge"><svg class="icon" width="10" height="10" aria-hidden="true"><use href="#icon-check-circle-2"></use></svg> Tuyo</div>
            <div style="width:100%;">
                <h3 class="card-name">${item.name}</h3>
                ${actionsHTML}
            </div>`;

        container.appendChild(card);
    });

    container.querySelectorAll('.library-mail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            try {
                const item        = JSON.parse(btn.dataset.item.replace(/&#39;/g, "'"));
                const relativeUrl = btn.dataset.url;
                const absoluteUrl = new URL(relativeUrl, window.location.href).href;
                openEmailModal(item, absoluteUrl);
            } catch (e) { console.error('MailBtn error', e); }
        });
    });

    // Analítica — click_download (fuente: biblioteca / Mis Tesoros)
    container.querySelectorAll('a.vault-btn[download]').forEach(link => {
        link.addEventListener('click', () => {
            // Extraer nombre del wallpaper desde el alt de la imagen hermana más cercana
            const card = link.closest('.shop-card');
            const name = card?.querySelector('.card-name')?.textContent?.trim() || 'desconocido';
            window.GhostAnalytics?.track('click_download', {
                wallpaper: name,
                fuente: 'biblioteca'
            });
        });
    });

    refreshIcons(container); // scope a la biblioteca renderizada
}

// ── Render: Historial ─────────────────────────────────────────────────────────
function renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;
    const history = GameCenter.getHistory();

    if (!history.length) {
        container.innerHTML =
            '<p style="color:var(--text-low); font-size:0.8rem; text-align:center; padding:16px 0;">Sin transacciones aún.</p>';
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

// ── Compra ────────────────────────────────────────────────────────────────────
async function initiatePurchase(item, btn) {
    const eco        = window.ECONOMY;
    const finalPrice = eco.isSaleActive ? Math.floor(item.price * eco.saleMultiplier) : item.price;
    const cashback   = Math.floor(finalPrice * eco.cashbackRate);
    const netCost    = finalPrice - cashback;

    const bodyHTML =
        `<div class="modal-product-row">
            <span class="modal-label">Wallpaper</span>
            <span class="modal-value" style="color:var(--text-high); font-size:0.85rem;">${item.name}</span>
        </div>
        ${eco.isSaleActive
            ? `<div class="modal-product-row">
                   <span class="modal-label">Precio original</span>
                   <span class="modal-strikethrough">${item.price} ⭐</span>
               </div>
               <div class="modal-product-row">
                   <span class="modal-label">Con oferta</span>
                   <span class="modal-value--sale">${finalPrice} ⭐</span>
               </div>`
            : `<div class="modal-product-row">
                   <span class="modal-label">Precio</span>
                   <span class="modal-value">${item.price} ⭐</span>
               </div>`}
        ${cashback > 0
            ? `<div class="modal-product-row">
                   <span class="modal-label">Cashback</span>
                   <span class="modal-value--cashback">+${cashback} ⭐</span>
               </div>`
            : ''}
        <div class="modal-product-row modal-product-row--total">
            <span class="modal-label" style="font-weight:700;">Costo neto</span>
            <span class="modal-value--total">${netCost} ⭐</span>
        </div>`;

    const confirmed = await openConfirmModal({
        title:       '¿Canjear wallpaper?',
        bodyHTML,
        confirmText: `Canjear · ${finalPrice} ⭐`
    });
    if (!confirmed) return;

    const result = GameCenter.buyItem(item);
    if (result.success) {
        filterItems();
        renderLibrary(allItems);
        // Actualizar displays: navbar con formato abreviado, resto con valor exacto.
        const bal = GameCenter.getBalance();
        document.querySelectorAll('.navbar .coin-display').forEach(el => {
            el.textContent = window.formatCoinsNavbar?.(bal) ?? bal;
            el.closest('.coin-badge')?.setAttribute('title', `${bal} monedas`);
        });
        document.querySelectorAll('.coin-display:not(.navbar .coin-display)').forEach(el => el.textContent = bal);
        fireConfetti();
        // Analítica — buy_item: registra qué wallpaper se compró con todos sus detalles
        window.GhostAnalytics?.track('buy_item', {
            wallpaper:  item.name,
            precio:     `${result.finalPrice} ⭐`,
            cashback:   result.cashback > 0 ? `+${result.cashback} ⭐` : 'ninguno',
            categoría:  Array.isArray(item.tags) && item.tags.length ? item.tags[0] : 'General',
            saldo_tras: GameCenter.getBalance()
        });
        const cbNote = result.cashback > 0 ? ` <strong>+${result.cashback} cashback</strong> devueltas.` : '';
        showToast(`"${item.name}" desbloqueado.${cbNote} Ve a <strong>Mis Tesoros</strong>.`, 'success');
        } else {
        if (result.reason === 'coins') {
            if (btn) shakeElement(btn);
            showToast('No tienes suficientes monedas.', 'error');
        }
    }
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
function fireConfetti() {
    // No disparar si la pestaña está inactiva (performance)
    if (document.hidden) return;
    // Verificar que estamos en la vista de Tienda
    if (window.SpaRouter?.getCurrentView?.() !== 'shop') return;

    const colors = ['#9b59ff', '#ff59b4', '#fbbf24', '#22d07a', '#00d4ff'];
    confetti({ particleCount: 55, angle: 60,  spread: 65, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 55, angle: 120, spread: 65, origin: { x: 1, y: 0.7 }, colors });
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
            // Actualizar displays: navbar con formato abreviado, resto con valor exacto.
            const bal = GameCenter.getBalance();
            document.querySelectorAll('.navbar .coin-display').forEach(el => {
                el.textContent = window.formatCoinsNavbar?.(bal) ?? bal;
                el.closest('.coin-badge')?.setAttribute('title', `${bal} monedas`);
            });
            document.querySelectorAll('.coin-display:not(.navbar .coin-display)').forEach(el => el.textContent = bal);
            if (!document.hidden) {
                confetti({ particleCount: 80, spread: 100, origin: { y: 0.4 }, colors: ['#fbbf24','#9b59ff','#22d07a'] });
            }
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

// ── Sale Banner + Economy Info ────────────────────────────────────────────────
function initSaleBanner() {
    const eco    = window.ECONOMY;
    const banner = document.getElementById('sale-banner');
    if (!banner) return;
    if (eco.isSaleActive) {
        banner.classList.remove('hidden');
        const pct     = Math.round((1 - eco.saleMultiplier) * 100);
        const badgeEl = document.getElementById('sale-badge-pct');
        document.getElementById('sale-label-text').textContent = `¡${eco.saleLabel}!`;
        document.getElementById('sale-desc-text').textContent  =
            `${pct}% de descuento + ${Math.round(eco.cashbackRate * 100)}% de cashback en toda la tienda.`;
        if (badgeEl) badgeEl.textContent = `${pct}%`;
    }
    // Scope al banner; el ícono de rayo (zap) solo vive dentro de este nodo.
    refreshIcons(banner);
}

function initEconomyInfo() {
    const eco    = window.ECONOMY;
    const saleEl = document.getElementById('eco-sale-status');
    const cbEl   = document.getElementById('eco-cashback');
    if (!saleEl || !cbEl) return;
    const pct = Math.round((1 - eco.saleMultiplier) * 100);
    saleEl.textContent = eco.isSaleActive ? `${pct}% OFF activo` : 'Sin oferta activa';
    saleEl.className   = 'eco-badge' + (eco.isSaleActive ? ' eco-badge--sale' : '');
    cbEl.textContent   = `${Math.round(eco.cashbackRate * 100)}% en cada compra`;
    cbEl.className     = 'eco-badge eco-badge--green';
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
    if (thumbEl) { thumbEl.src = item.image; thumbEl.alt = item.name; }
    if (nameEl)  { nameEl.textContent = item.name; }

    const inputEl = document.getElementById('email-modal-input');
    if (inputEl) {
        inputEl.value = window.MailHelper.getLastMailRecipient();
        _setEmailError(false);
    }

    const fallbackEl = document.getElementById('email-fallback');
    if (fallbackEl) fallbackEl.classList.remove('visible');

    const modal = document.getElementById('email-modal');
    modal.classList.remove('hidden');
    // Guardar foco activo para restaurarlo al cerrar el modal (WCAG 2.4.3).
    _lastFocusedElement = document.activeElement;
    refreshIcons(modal);
    requestAnimationFrame(() => { if (inputEl) inputEl.focus(); });
}

function _closeEmailModal() {
    document.getElementById('email-modal').classList.add('hidden');
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
     * Refresca el estado de economía y los badges de luna sin re-renderizar
     * el catálogo completo (que ya está en memoria).
     */
    onEnter() {
        initEconomyInfo();
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
        // Re-aplicar filtros activos: si el usuario vuelve a la Tienda después de
        // navegar al Home, el catálogo se refiltra con el estado previo de activeFilter
        // y searchQuery en lugar de resetear a "Todos". Esto preserva el contexto
        // de navegación y evita la frustración de perder un filtro aplicado.
        if (allItems.length) filterItems();
        _updateGiftFilterGlow();

        // Scope a la vista de la tienda. El sale banner, tabs y pills tienen
        // iconos dinámicos que pueden necesitar re-inicialización al volver a la vista.
        const shopView = document.getElementById('view-shop');
        if (shopView) refreshIcons(shopView);
    },

    /**
     * Llamado por spa-router.js al SALIR de la vista de Tienda (v9.6).
     * Desconecta el IntersectionObserver de precarga para liberar recursos
     * cuando el catálogo no es visible. Se reconecta automáticamente en el
     * próximo renderShop() al volver a la vista.
     */
    onLeave() {
        if (_preloadObserver) {
            _preloadObserver.disconnect();
            _preloadObserver = null;
        }
    }
};

// ── Carga del catálogo con manejo de errores y reintento ─────────────────────

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
    const emptyEl   = document.getElementById('filter-empty');

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

    Promise.all([
        fetch('data/shop.json').then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        }),
        fetch('data/shop-gifts.json')
            .then(r => (r.ok ? r.json() : []))
            .catch(() => [])
    ])
        .then(([items, gifts]) => {
            try {
                const catalogHash = btoa(unescape(encodeURIComponent(JSON.stringify(items)))).slice(0, 120);
                localStorage.setItem('love_arcade_shop_catalog_hash_v1', catalogHash);
            } catch (_) {}
            const baseCatalog = items.filter(item => !_isGiftItem(item));
            const giftCatalog = gifts.length ? gifts : items.filter(item => _isGiftItem(item));
            allItems = [...baseCatalog, ...giftCatalog];
            if (gridEl) gridEl.innerHTML = '';
            filterItems();
            renderLibrary(allItems);
        
            // Asegurar que el error state está oculto si se cargó correctamente
            if (errorEl) errorEl.classList.add('hidden');

            // [v9.9.2] user_snapshot — instantánea de estado enviada UNA VEZ por sesión.
            // sessionStorage se resetea al cerrar la pestaña; persistencia exacta para
            // una "primera impresión" por visita sin datos redundantes entre navegaciones SPA.
            // No se envía en retries del catálogo (loadCatalog puede llamarse múltiples veces).
            if (!sessionStorage.getItem('ga_snapshot_sent')) {
                try {
                    sessionStorage.setItem('ga_snapshot_sent', '1');
                    const gc          = window.GameCenter;
                    const inventory   = gc?.getInventory?.() || {};
                    const comprados   = Object.values(inventory).filter(v => v > 0).length;
                    const disponibles = allItems.length - comprados;
                    const state       = gc?.getState?.() || {};

                    window.GhostAnalytics?.track('user_snapshot', {
                        saldo:           state.coins ?? gc?.getBalance?.() ?? 0,
                        comprados,
                        disponibles,
                        racha:           state.streak ?? 0,
                        códigos_canjeados: gc?.getRedeemedCount?.() ?? 0
                    });
                } catch (_) { /* nunca interrumpir la carga del catálogo */ }
            }
        })
        .catch(err => {
            console.error('[ShopLogic] Error cargando shop.json:', err);

            // Ocultar grid y mostrar error state
            if (gridEl)  gridEl.classList.add('hidden');
            if (emptyEl) emptyEl.classList.add('hidden');
            if (errorEl) {
                errorEl.classList.remove('hidden');
            }

            // Botón de reintento — registrar listener solo una vez usando dataset
            if (retryBtn && !retryBtn.dataset.bound) {
                retryBtn.dataset.bound = 'true';
                retryBtn.addEventListener('click', () => {
                    delete retryBtn.dataset.bound; // Permitir re-bind tras retry
                    loadCatalog();
                });
            }
        });
}

// ── DOMContentLoaded — Registro de event listeners (una sola vez) ─────────────
document.addEventListener('DOMContentLoaded', () => {
    _bindShopContainerDelegation();

    // Inicializar banner y economía al cargar
    initSaleBanner();
    initEconomyInfo();
    renderMoonBlessingStatus();
    renderStreakCalendar();

    // Confirm modal
    document.getElementById('modal-cancel').addEventListener('click',  () => _closeModal(false));
    document.getElementById('modal-confirm').addEventListener('click', () => _closeModal(true));
    document.getElementById('confirm-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) _closeModal(false);
    });

    // Preview modal (Preview 2.0)
    // The static #preview-close button (X in corner) and backdrop click both
    // call the public closePreviewModal() so DOM refs are resolved inside the function.
    document.getElementById('preview-close').addEventListener('click', () => closePreviewModal());
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
            document.getElementById('confirm-modal').classList.add('hidden');
            closePreviewModal();
            _closeEmailModal();
        }
    });

    // Toggle código promo
    document.getElementById('btn-promo-toggle').addEventListener('click', () => {
        const toggleBtn = document.getElementById('btn-promo-toggle');
        const section   = document.getElementById('promo-section');
        const expanded  = toggleBtn.getAttribute('aria-expanded') === 'true';
        toggleBtn.setAttribute('aria-expanded', String(!expanded));
        section.setAttribute('aria-hidden',    String(expanded));
        section.classList.toggle('promo-section--collapsed', expanded);
        section.classList.toggle('promo-section--open', !expanded);
        if (!expanded) setTimeout(() => document.getElementById('promo-input').focus(), 50);
    });

    // ── Cargar catálogo UNA SOLA VEZ (con manejo de errores y reintento) ────────
    loadCatalog();

    // Promo code
    document.getElementById('btn-redeem').addEventListener('click', handleRedeem);
    document.getElementById('promo-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') handleRedeem();
    });

    // Tabs
    document.querySelectorAll('.shop-tab').forEach(btn =>
        btn.addEventListener('click', () => switchTab(btn.dataset.tab))
    );

    // Search con debounce
    const searchInput  = document.getElementById('search-input');
    const clearBtn     = document.getElementById('search-clear');
    const debouncedFilter = window.debounce(() => {
        searchQuery = searchInput.value.trim().toLowerCase();
        scheduleFilterItems();
    }, 300);

    searchInput.addEventListener('input', () => {
        clearBtn.classList.toggle('hidden', !searchInput.value);
        debouncedFilter();
    });
    clearBtn.addEventListener('click', () => {
        if (!searchInput.value && !searchQuery) return;
        searchInput.value = '';
        searchQuery       = '';
        clearBtn.classList.add('hidden');
        scheduleFilterItems();
        requestAnimationFrame(() => searchInput.focus({ preventScroll: true }));
    });

    // Botón "Ver todo el catálogo" en el estado vacío de filtros
    // Reemplaza el onclick inline del HTML para respetar CSP y separación de responsabilidades.
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => resetFilters());

    // Filter pills
    document.querySelectorAll('.pill').forEach(pill => {
        pill.addEventListener('click', () => {
            if (activeFilter === pill.dataset.filter) return;
            document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeFilter = pill.dataset.filter;
            scheduleFilterItems();
        });
    });

    document.getElementById('gift-carousel-track')?.addEventListener('click', e => {
        const giftBtn = e.target.closest('[data-gift-action]');
        if (!giftBtn) return;
        _handleGiftAction(parseInt(giftBtn.dataset.giftAction, 10));
    });
    document.getElementById('gift-collection-toggle')?.addEventListener('click', () => {
        const grid = document.getElementById('gift-collection-grid');
        const btn = document.getElementById('gift-collection-toggle');
        if (!grid || !btn) return;
        const willOpen = grid.classList.contains('hidden');
        grid.classList.toggle('hidden', !willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
    });

    document.addEventListener('la:levelcomplete', () => {
        window.__laSessionGameCompleted = true;
        try { sessionStorage.setItem('la_session_game_completed', '1'); } catch (_) { /* noop */ }
        _updateGiftFilterGlow();
        if (activeFilter === 'Regalos') filterItems();
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

    // Scan global ÚNICO al final del init: todos los iconos del HTML estático
    // (navbars, botones de ajustes, FAQs) se inicializan aquí. A partir de este
    // punto, todos los refreshIcons() en renders dinámicos usan scope explícito.
    refreshIcons();
});
