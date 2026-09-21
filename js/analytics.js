/**
 * analytics.js — Love Arcade v12.2
 * ─────────────────────────────────────────────────────────────────────────────
 * Sistema de Analíticas "Ghost" — Captura eventos de interacción y los envía
 * en tiempo real al canal privado de Telegram a través del Proxy Serverless
 * `/api/report` desplegado en Vercel.
 *
 * CAMBIOS v12.2 (Control de Antigüedad en Cola + client_event_ts):
 *
 *  ── Evitar envío de eventos obsoletos ────────────────────────────────────
 *  - track() ahora guarda cada item pendiente como { event, meta, queuedAt,
 *    clientEventTs } para conservar el instante real del evento y el instante
 *    de encolado.
 *  - _flushPendingQueue() calcula la edad de cada item y descarta eventos con
 *    más de _PENDING_QUEUE_TTL_MS (5 min) para evitar enviar telemetría vieja
 *    tras desbloqueos tardíos del Human Gate o del nickname.
 *  - Los descartes por expiración se registran solo en _log() debug.
 *
 *  ── Timestamp de cliente explícito en payload ─────────────────────────────
 *  - _send() añade `client_event_ts` al payload con el momento original del
 *    evento (no el momento del envío).
 *  - Esta separación permite diagnosticar claramente “dato viejo” frente a
 *    latencia de red normal cuando se compara contra el timestamp de servidor.
 *
 * CAMBIOS v12.0 (Migración a Telegram Proxy — Infraestructura de Telemetría Segura):
 *
 *  ── Migración de transporte ───────────────────────────────────────────────
 *  - ELIMINADO el Webhook de Discord y el array XOR de ofuscación (_r).
 *  - NUEVO endpoint: ruta relativa `/api/report` (Vercel Serverless Function).
 *    Vercel resuelve automáticamente la función sin configuración adicional.
 *  - El TELEGRAM_BOT_TOKEN y el TELEGRAM_CHAT_ID nunca abandonan el servidor.
 *    El frontend solo conoce la ruta interna del proxy.
 *
 *  ── Nuevo contrato de datos (Payload ligero) ───────────────────────────────
 *  - El frontend envía un objeto mínimo al proxy:
 *      { type, user, event, data }
 *  - El proxy se encarga del formateo en HTML, la inyección del timestamp
 *    de servidor y la clasificación en el Topic (hilo) correcto de Telegram.
 *  - El frontend ya no construye ni embeds ni mensajes: principio de
 *    responsabilidad única.
 *
 *  ── Clasificación automática de eventos por tipo ──────────────────────────
 *  - _EVENT_TYPE_MAP asigna cada nombre de evento a uno de los tres tipos:
 *      "analytics"   → Topic 2 (📈) — métricas de uso y sesión
 *      "achievement" → Topic 3 (🏆) — compras, códigos, bonos diarios
 *      "bug"         → Topic 4 (🚨) — errores capturados y códigos inválidos
 *
 *  ── Sin cambios en la lógica de seguridad ─────────────────────────────────
 *  - El Doble Candado (Anti-Bot + Anti-Localhost) y el Human Gate se mantienen
 *    intactos. Solo la capa de transporte ha sido refactorizada.
 *
 * CAMBIOS v11.0 (Doble Candado — Anti-Bot + Human Gate):
 *
 *  ── Candado 1: Filtrado de Entorno (La Criba) ─────────────────────────────
 *  - Anti-Localhost: _isLocalhost() detecta hostname === 'localhost',
 *    '127.0.0.1', '' o sufijo '.local'. Si true, track() aborta silenciosamente
 *    y el módulo muestra un aviso en consola al cargar.
 *  - Anti-Bot: _isBot() verifica navigator.userAgent contra una blacklist de
 *    patrones conocidos (Vercel, Googlebot, Bingbot, Lighthouse, HeadlessChrome,
 *    Puppeteer, UptimeRobot, Pingdom, curl, wget, etc.). Si true, track() aborta.
 *  - Ambas verificaciones son evaluadas en cada llamada a track() y a test(),
 *    garantizando que ningún código externo pueda bypassearlas al llamar _send()
 *    directamente (la función privada no es accesible desde fuera del módulo).
 *
 *  ── Candado 2: Validación de Actividad Humana (Human Gate) ────────────────
 *  - Eliminado el disparo automático en onload / DOMContentLoaded.
 *  - Al cargar el módulo, _humanGateInit() comprueba si el usuario ya tiene
 *    un nickname configurado en localStorage (clave 'gamecenter_v6_promos').
 *    Si existe → _humanGateUnlocked = true inmediatamente.
 *    Si no existe → se registran listeners de un solo disparo (once:true) en
 *    'click', 'keydown' y 'scroll' para detectar la primera interacción real.
 *  - track() verifica el gate en cada llamada. Si está cerrado, el evento se
 *    encola en _pendingQueue (máx. 50 items) para su envío posterior.
 *
 *  ── Nickname obligatorio en todos los payloads ────────────────────────────
 *  - Todas las peticiones al Proxy incluyen el campo 'user' con el nickname
 *    del jugador, leído por _getNickname() desde localStorage.
 *  - Si el gate se abre por interacción real pero el nickname aún no está
 *    disponible (usuario nuevo en Identity Modal), los eventos permanecen en
 *    _pendingQueue. _startNicknamePoller() lanza un sondeo cada 500 ms hasta
 *    detectar el nickname, momento en que _flushPendingQueue() envía todos los
 *    eventos acumulados con el campo 'user' ya disponible.
 *  - El poller se auto-cancela al encontrar el nickname, o tras 10 minutos
 *    (NICKNAME_POLL_TIMEOUT_MS) para evitar pollers zombi.
 *
 * CAMBIOS v10.0 (Shadow-Gate — Developer Exclusion Filter):
 *  - Nuevo filtro Shadow-Gate: detecta el token ofuscado `?ref=x92_v0id_z1`
 *    en window.location.search al cargar el script.
 *  - Si el token está presente, se persiste un flag en sessionStorage bajo
 *    la clave `ghost_ignore` con valor `'true'`.
 *  - La exclusión se mantiene activa mientras la pestaña esté abierta
 *    (incluyendo navegaciones SPA y refrescos), y se anula al cerrar la pestaña.
 *  - track() verifica el flag en cada llamada mediante _isShadowGated().
 *    Si la exclusión está activa, el evento se descarta silenciosamente.
 *  - Los handlers de error globales (window.error / unhandledrejection) también
 *    quedan silenciados cuando Shadow-Gate está activo.
 *  - status() ahora informa si la sesión está bajo Shadow-Gate.
 *  - El token no contiene palabras como "admin" o "dev" para pasar desapercibido
 *    como un parámetro de tracking genérico en logs de red.
 *
 * CAMBIOS v9.9.2 (Hardening & Error Detection):
 *  - De-duplicación de redeem_code: track() eliminado de app.js/redeemPromoCode();
 *    el único punto de disparo es handleRedeem() en shop-logic.js (fin de la
 *    cadena de éxito de UI), eliminando el doble reporte anterior.
 *  - detected_error enriquecido con contexto forense: nueva función privada
 *    _getExecutionContext() que añade url, online, mem_mb y vista a cada error
 *    capturado por los handlers de window.error y unhandledrejection.
 *  - Nuevo evento invalid_promo_code: disparado en handleRedeem() cuando el
 *    código no existe en PROMO_CODES_HASHED, diferenciando intentos de adivinar
 *    códigos de errores reales de lógica.
 *  - Nuevo evento insufficient_funds: disparado en buyItem() y buyMoonBlessing()
 *    de app.js, registra wallpaper, precio y saldo actual para diagnóstico de
 *    precios elevados o HUD de saldo poco claro.
 *  - Nuevo evento wishlist_add: disparado al añadir (no al quitar) un ítem a
 *    la lista de deseos. Permite detectar tendencias de catálogo.
 *  - Nuevo evento daily_bonus: disparado en claimDaily() en éxito; registra
 *    recompensa base, bonus lunar y racha sin saturar el canal con intentos fallidos.
 *  - Nuevo evento user_snapshot: enviado UNA SOLA VEZ por sesión (sessionStorage)
 *    tras la carga del catálogo, con saldo, items comprados / disponibles, racha y
 *    códigos canjeados. No se repite en navigations SPA ni retries del catálogo.
 *    ⚠️ v11.0: este evento queda retenido en _pendingQueue hasta que el Human Gate
 *    esté abierto y el nickname esté disponible.
 *
 * CÓMO DIAGNOSTICAR DESDE DEVTOOLS:
 *
 *   1. Verificar que el módulo cargó:
 *      Busca en consola → "[GhostAnalytics] ✅ Módulo listo"
 *
 *   2. Enviar un evento de prueba al Proxy:
 *      window.GhostAnalytics.test()
 *
 *   3. Activar logs detallados (muestra cada evento antes de enviarse):
 *      window.GhostAnalytics.debug(true)
 *      → También resetea el rate limiter para poder re-disparar eventos
 *         sin esperar los 3 s.
 *
 *   4. Ver el estado interno actual (rate limiter, Human Gate, Anti-Bot, etc.):
 *      window.GhostAnalytics.status()
 *
 * ACTIVAR SHADOW-GATE (exclusión de analíticas para el desarrollador):
 *
 *   Abre la plataforma con el token en la URL:
 *     https://tudominio.com/?ref=x92_v0id_z1
 *
 *   El flag se guarda en sessionStorage. A partir de ese momento, track()
 *   no enviará ningún evento durante toda la sesión, aunque navegues por
 *   otras páginas o refresques. Al cerrar la pestaña el flag se elimina.
 *
 *   Para verificar que está activo:
 *     window.GhostAnalytics.status()
 *     → "Shadow-Gate: ACTIVO 🔕 — esta sesión está excluida de las analíticas"
 *
 * PRINCIPIOS DE DISEÑO:
 *  - Fire-and-forget: fetch nunca bloquea el hilo principal.
 *  - Sin feedback loop: las peticiones de analytics no disparan el handler
 *    de errores mediante WeakSet de promesas en vuelo.
 *  - Rate limiting: máximo 1 evento idéntico cada 3 s.
 *  - Sin datos personales: sin IPs, IDs de usuario ni cookies. El campo
 *    'user' contiene únicamente el nickname elegido por el propio jugador.
 *  - Silencioso en producción: ningún console.log salvo errores reales y
 *    el mensaje de carga inicial.
 *  - Degradación elegante: si el módulo no carga, las llamadas con ?.track()
 *    en app.js y shop-logic.js son no-operativas.
 *  - Human-only: ningún evento se envía sin confirmación de actividad humana
 *    real o presencia de un nickname ya configurado en el store local.
 *  - Token seguro: el bot token de Telegram nunca abandona el servidor.
 *    El frontend solo conoce la ruta relativa del proxy (/api/report).
 *
 * ORDEN DE CARGA REQUERIDO EN index.html:
 *   <script src="js/analytics.js"></script>   ← primero
 *   <script src="js/app.js"></script>
 *   <script src="js/shop-logic.js"></script>
 *   <script src="js/spa-router.js"></script>
 */

(function () {
    'use strict';

    // ── Shadow-Gate v10.0 — Developer Exclusion Filter ────────────────────────
    //
    // Token de alta entropía diseñado para pasar desapercibido como un
    // parámetro UTM/tracking genérico en logs de red y herramientas de QA.
    // No contiene palabras clave como "admin", "dev" o "test".
    //
    // URL de activación:  https://tudominio.com/?ref=x92_v0id_z1
    //
    // Una vez activado, el flag `ghost_ignore` en sessionStorage persiste
    // mientras la pestaña esté abierta (incluyendo refrescos y navegación SPA).
    // Al cerrar la pestaña sessionStorage se vacía automáticamente.
    //
    const _SHADOW_TOKEN = 'x92_v0id_z1';
    const _SHADOW_KEY   = 'ghost_ignore';

    /**
     * Detecta el token Shadow-Gate en la URL y activa la exclusión.
     * Se ejecuta de forma inmediata al cargar el script, antes de que
     * cualquier evento o función del módulo pueda dispararse.
     */
    (function _shadowGateInit() {
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('ref') === _SHADOW_TOKEN) {
                sessionStorage.setItem(_SHADOW_KEY, 'true');
            }
        } catch (_) { /* silencioso — sessionStorage puede estar bloqueado en modo privado */ }
    })();

    /**
     * Devuelve true si la sesión actual está bajo Shadow-Gate.
     * Envuelto en try/catch para no romper el módulo si sessionStorage
     * no está disponible (p. ej. iframes con sandbox estricto).
     *
     * @returns {boolean}
     */
    function _isShadowGated() {
        try {
            return sessionStorage.getItem(_SHADOW_KEY) === 'true';
        } catch (_) {
            return false;
        }
    }

    // ── Candado 1A — Anti-Localhost (v11.0) ───────────────────────────────────
    //
    // Aborta cualquier envío si el script se ejecuta en un entorno de desarrollo
    // local. Cubre los casos más comunes: localhost, IPv4 loopback, dominio
    // .local (mDNS) y el caso extremo de hostname vacío (file:// protocol).
    //
    // Esta verificación se realiza en cada llamada a track() —no solo al cargar
    // el módulo— para cubrir el caso de un router SPA que cambie el hash/path
    // sin recargar el script pero que se estuviera probando en local.
    //

    /**
     * Devuelve true si el script se ejecuta en localhost o en un entorno local.
     * @returns {boolean}
     */
    function _isLocalhost() {
        const h = window.location.hostname;
        return (
            h === 'localhost'    ||
            h === '127.0.0.1'   ||
            h === ''             ||   // protocolo file://
            h.endsWith('.local')
        );
    }

    // ── Candado 1B — Anti-Bot / User-Agent Blacklist (v11.0) ─────────────────
    //
    // Lista de patrones que coinciden con user-agents de:
    //   · Rastreadores de motores de búsqueda (Google, Bing, Yahoo, Baidu, etc.)
    //   · Herramientas de auditoría de rendimiento (Lighthouse, Chrome-Lighthouse)
    //   · Plataformas de despliegue que realizan health-checks (Vercel)
    //   · Monitores de uptime (UptimeRobot, Pingdom, StatusCake)
    //   · Bots de redes sociales / previews (Slack, Twitter, Facebook, LinkedIn)
    //   · Browsers headless y herramientas de automatización (HeadlessChrome,
    //     PhantomJS, Puppeteer, Selenium, WebDriver)
    //   · Clientes HTTP no-browser (node-fetch, axios, python-requests, curl, wget)
    //
    // Los patrones son case-insensitive (/i) para mayor robustez.
    //
    const _BOT_UA_PATTERNS = [
        // ── Motores de búsqueda ──────────────────────────────────────────────
        /Googlebot/i,
        /Bingbot/i,
        /Slurp/i,           // Yahoo
        /DuckDuckBot/i,
        /Baiduspider/i,
        /YandexBot/i,
        /Sogou/i,
        /Exabot/i,
        /facebot/i,
        /ia_archiver/i,     // Alexa / Internet Archive
        // ── Crawlers genéricos ───────────────────────────────────────────────
        /[_\s]bot[_\s/;)]/i,    // patron "bot" delimitado (evita falsos positivos en "Robot")
        /crawler/i,
        /spider/i,
        /scraper/i,
        /fetch/i,
        // ── Auditorías de rendimiento ────────────────────────────────────────
        /Lighthouse/i,
        /Chrome-Lighthouse/i,
        /PTST/i,            // PageSpeed Insights
        /PageSpeed/i,
        // ── Despliegue / CI ──────────────────────────────────────────────────
        /vercel/i,
        /Vercel-Screenshot/i,
        // ── Monitores de uptime ──────────────────────────────────────────────
        /UptimeRobot/i,
        /Pingdom/i,
        /StatusCake/i,
        /Site24x7/i,
        /GTmetrix/i,
        // ── Previews de redes sociales ───────────────────────────────────────
        /facebookexternalhit/i,
        /Twitterbot/i,
        /Slackbot/i,
        /linkedinbot/i,
        /rogerbot/i,        // Moz
        /embedly/i,
        /quora link preview/i,
        /showyoubot/i,
        /outbrain/i,
        /pinterest/i,
        /vkShare/i,
        /W3C_Validator/i,
        // ── Browsers headless y automatización ──────────────────────────────
        /HeadlessChrome/i,
        /PhantomJS/i,
        /Puppeteer/i,
        /selenium/i,
        /webdriver/i,
        /SlimerJS/i,
        /CasperJS/i,
        // ── Clientes HTTP no-browser ─────────────────────────────────────────
        /node-fetch/i,
        /node-http/i,
        /axios/i,
        /python-requests/i,
        /python-urllib/i,
        /Java\//i,
        /curl\//i,
        /Wget\//i,
        /Go-http-client/i,
        /okhttp/i,
    ];

    /**
     * Devuelve true si el user-agent actual coincide con algún patrón de bot
     * conocido. Se evalúa una sola vez por llamada; no se cachea para no
     * interferir con user-agents dinámicos (aunque en la práctica son estáticos).
     *
     * @returns {boolean}
     */
    function _isBot() {
        const ua = navigator.userAgent || '';
        return _BOT_UA_PATTERNS.some(pattern => pattern.test(ua));
    }

    // ── Candado 2 — Human Gate (v11.0) ───────────────────────────────────────
    //
    // Impide el envío de cualquier evento analítico hasta que se confirme
    // actividad humana real. La confirmación ocurre por dos vías:
    //
    //   A) Nickname existente: si el store en localStorage ya tiene un nickname
    //      configurado al cargar el módulo, el gate se abre inmediatamente. Esto
    //      cubre a usuarios recurrentes que ya completaron el Identity Modal.
    //
    //   B) Primera interacción: si no hay nickname, se registran listeners de
    //      un solo disparo (once:true) en 'click', 'keydown' y 'scroll'. En el
    //      primer evento de cualquiera de los tres, el gate se abre.
    //      Si en ese momento todavía no hay nickname (usuario nuevo en el
    //      Identity Modal), los eventos quedan encolados en _pendingQueue y
    //      _startNicknamePoller() espera hasta que se confirme el nickname.
    //
    // Clave del store — debe coincidir con CONFIG.stateKey en app.js.
    const _STATE_KEY = 'gamecenter_v6_promos';

    /**
     * Lee el nickname del usuario desde el store en localStorage.
     * Devuelve el string del nickname si existe y no está vacío, o null.
     *
     * No lanza nunca: envuelto en try/catch para no romper el módulo si
     * localStorage está bloqueado (modo privado estricto, iframe sandbox).
     *
     * @returns {string|null}
     */
    function _getNickname() {
        try {
            const raw = localStorage.getItem(_STATE_KEY);
            if (!raw) return null;
            const { nickname } = JSON.parse(raw);
            return (typeof nickname === 'string' && nickname.trim())
                ? nickname.trim()
                : null;
        } catch (_) {
            return null;
        }
    }

    /** true cuando se ha confirmado actividad humana real o nickname existente. */
    let _humanGateUnlocked = false;

    /**
     * Cola de eventos pendientes de envío, retenidos mientras el Human Gate
     * está cerrado o mientras el nickname no está disponible.
     * Limitada a _PENDING_QUEUE_MAX para evitar acumulación en sesiones largas.
     * @type {Array<{ event: string, meta: object, queuedAt: number, clientEventTs: number }>}
     */
    const _pendingQueue = [];

    /** Capacidad máxima de la cola de eventos pendientes. */
    const _PENDING_QUEUE_MAX = 50;

    /** TTL de la cola pendiente para evitar enviar eventos obsoletos (5 min). */
    const _PENDING_QUEUE_TTL_MS = 5 * 60 * 1_000;

    /** Referencia al intervalo del nickname poller (null si no está activo). */
    let _nicknamePoller = null;

    /** Tiempo máximo de espera del nickname poller antes de cancelarse (10 min). */
    const _NICKNAME_POLL_TIMEOUT_MS = 10 * 60 * 1_000;

    /** Timestamp de inicio del poller (para calcular el timeout). */
    let _nicknamePollerStart = 0;

    /**
     * Intenta enviar todos los eventos en _pendingQueue.
     * Si el nickname aún no está disponible, inicia el poller en lugar de enviar.
     * Vacía la cola solo cuando el nickname está confirmado.
     */
    function _flushPendingQueue() {
        const nickname = _getNickname();

        if (!nickname) {
            // No hay nickname todavía — iniciar el poller si no está corriendo
            _startNicknamePoller();
            return;
        }

        const now = Date.now();

        // Vaciar la cola enviando cada evento con el nickname ya disponible.
        // Si el evento ya superó el TTL, se descarta para no enviar dato viejo.
        while (_pendingQueue.length > 0) {
            const {
                event,
                meta,
                queuedAt,
                clientEventTs,
            } = _pendingQueue.shift();

            const ageMs = now - (queuedAt || now);
            if (ageMs > _PENDING_QUEUE_TTL_MS) {
                _log('⌛ Evento pendiente expirado — descartado:', event,
                    `(edad ${Math.round(ageMs / 1000)}s > TTL ${Math.round(_PENDING_QUEUE_TTL_MS / 1000)}s)`);
                continue;
            }

            const key = `${event}:${JSON.stringify(meta)}`;
            if (_isRateLimited(key)) continue;
            _send(event, { ...meta }, nickname, false, { clientEventTs });
        }
        _log(`📤 Cola vaciada. ${_pendingQueue.length} eventos pendientes restantes.`);
    }

    /**
     * Inicia el sondeo periódico del nickname (cada 500 ms).
     * Al detectar el nickname, cancela el intervalo y vacía la cola.
     * Se cancela automáticamente tras NICKNAME_POLL_TIMEOUT_MS para
     * evitar pollers zombi en sesiones donde el usuario nunca configura su nick.
     */
    function _startNicknamePoller() {
        // No iniciar un segundo poller si ya hay uno activo
        if (_nicknamePoller) return;

        _nicknamePollerStart = Date.now();
        _log('⏳ Nickname poller iniciado (sondeo cada 500 ms, máx 10 min)…');

        _nicknamePoller = setInterval(() => {
            // Timeout de seguridad — evitar pollers zombi
            if (Date.now() - _nicknamePollerStart >= _NICKNAME_POLL_TIMEOUT_MS) {
                clearInterval(_nicknamePoller);
                _nicknamePoller = null;
                _log('⚠️ Nickname poller cancelado por timeout (10 min). Cola descartada.');
                _pendingQueue.length = 0;
                return;
            }

            const nickname = _getNickname();
            if (nickname) {
                clearInterval(_nicknamePoller);
                _nicknamePoller = null;
                _log(`👤 Nickname detectado ("${nickname}") — vaciando cola…`);
                _flushPendingQueue();
            }
        }, 500);
    }

    /**
     * Abre el Human Gate y notifica la cola de eventos pendientes.
     * Idempotente: llamadas adicionales después del primer unlock son no-operativas.
     */
    function _unlockHumanGate() {
        if (_humanGateUnlocked) return;
        _humanGateUnlocked = true;
        _log('🔓 Human Gate desbloqueado por interacción real del usuario.');
        _flushPendingQueue();
    }

    /**
     * Inicializa el Human Gate al cargar el módulo.
     * Ruta A: nickname existente → unlock inmediato.
     * Ruta B: sin nickname → registrar listeners de interacción (once:true).
     *
     * Se ejecuta de forma inmediata al definirse (IIFE interno).
     */
    (function _humanGateInit() {
        // ── Ruta A: usuario recurrente con nickname ──────────────────────────
        if (_getNickname()) {
            _humanGateUnlocked = true;
            return;
        }

        // ── Ruta B: primer acceso — esperar interacción real ─────────────────
        // Listeners de un solo disparo (once:true). El primero que se dispare
        // llama a _unlockHumanGate() y los demás quedan automáticamente
        // sin efecto (ya fueron removidos por la bandera `once`).
        const _onFirstInteraction = () => _unlockHumanGate();

        document.addEventListener('click',   _onFirstInteraction, { once: true, passive: true });
        document.addEventListener('keydown',  _onFirstInteraction, { once: true, passive: true });
        window .addEventListener('scroll',   _onFirstInteraction, { once: true, passive: true });
    })();

    // ── Endpoints del Proxy (v12.3) ───────────────────────────────────────────
    //
    // Lista ordenada de rutas equivalentes del proxy:
    //   1) Primario   → /api/telemetry
    //   2) Secundario → /api/report
    //
    // NOTA: /api/telemetry es un alias funcional de /api/report para esquivar
    // bloqueos agresivos de extensiones que filtran rutas con la palabra
    // "report". Ambas rutas resuelven al mismo handler serverless.
    //
    const _PROXY_ENDPOINTS = ['/api/telemetry', '/api/report'];
    const _PRIMARY_PROXY_ENDPOINT = _PROXY_ENDPOINTS[0];

    // ── Clasificación de eventos por tipo (v12.0) ─────────────────────────────
    //
    // El proxy usa este tipo para enrutar cada mensaje al Topic correcto de Telegram:
    //   "analytics"   → Topic 2 (📈) — métricas de uso general
    //   "achievement" → Topic 3 (🏆) — logros del jugador
    //   "bug"         → Topic 4 (🚨) — errores y comportamientos anómalos
    //
    // Los eventos no listados aquí caen en "analytics" por defecto.
    //
    const _EVENT_TYPE_MAP = {
        // ── Bugs / Errores ────────────────────────────────────────────────────
        detected_error:           'bug',
        invalid_promo_code:       'bug',
        storage_cleaned:          'bug',
        storage_warning:          'bug',
        wordsearch_content_alert: 'bug',    // Alerta de agotamiento de contenido
        // ── Logros del jugador ────────────────────────────────────────────────
        buy_item:                 'achievement',
        redeem_code:              'achievement',
        daily_bonus:              'achievement',
        // ── Analíticas (default) — no necesitan entrada explícita ─────────────
        // view_preview, click_download, open_game, insufficient_funds,
        // wishlist_add, user_snapshot, sync_export → 'analytics'
    };

    /**
     * Resuelve el tipo de evento para el campo `type` del payload del proxy.
     * @param {string} event
     * @returns {"analytics"|"achievement"|"bug"}
     */
    function _resolveEventType(event) {
        return _EVENT_TYPE_MAP[event] || 'analytics';
    }

    // ── Estado interno ────────────────────────────────────────────────────────
    let _debugMode = false;

    /** WeakSet de Promises en vuelo: evita que un fetch fallido de analytics
     *  dispare el handler de unhandledrejection y genere un bucle infinito. */
    const _pendingFetches = new WeakSet();

    /** Cache del rate limiter: clave → timestamp del último envío. */
    const _lastSent = {};

    /** Intervalo mínimo entre eventos con la misma clave (ms). */
    const RATE_LIMIT_MS = 3000;

    /** Configuración de resiliencia de transporte (reintentos + timeout). */
    const _SEND_MAX_ATTEMPTS = 3;
    const _SEND_TIMEOUT_MS = 2500;
    const _SEND_BACKOFF_BASE_MS = 350;

    /** Dedupe por bucket temporal: event + meta + bucket. */
    const _DEDUPE_BUCKET_MS = 10_000;
    const _dedupeLedger = new Set();

    /** Persistencia temporal de fallos transitorios (sessionStorage). */
    const _FAILED_QUEUE_KEY = 'ghost_failed_queue_v1';
    let _failedQueue = [];
    const _failureCounters = {
        timeout: 0,
        offline: 0,
        network: 0,
        http_5xx: 0,
        http_4xx: 0,
    };

    function _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function _bucketTs(ts) {
        return Math.floor(ts / _DEDUPE_BUCKET_MS) * _DEDUPE_BUCKET_MS;
    }

    function _buildDedupeKey(event, meta, bucketStart) {
        return `${event}|${JSON.stringify(meta || {})}|${bucketStart}`;
    }

    function _loadFailedQueue() {
        try {
            const raw = sessionStorage.getItem(_FAILED_QUEUE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function _saveFailedQueue() {
        try {
            sessionStorage.setItem(_FAILED_QUEUE_KEY, JSON.stringify(_failedQueue.slice(-50)));
        } catch (_) { /* sessionStorage puede no estar disponible */ }
    }

    function _enqueueFailed(job) {
        if (_failedQueue.some(item => item.dedupeKey === job.dedupeKey)) return;
        _failedQueue.push(job);
        _saveFailedQueue();
    }

    function _incrementFailureCounter(type) {
        if (Object.prototype.hasOwnProperty.call(_failureCounters, type)) {
            _failureCounters[type] += 1;
        }
    }

    async function _flushFailedQueue() {
        if (!_failedQueue.length) return;
        const snapshot = _failedQueue.slice();
        _failedQueue = [];
        _saveFailedQueue();

        for (const job of snapshot) {
            if (_dedupeLedger.has(job.dedupeKey)) continue;
            const result = await _send(job.event, job.meta, job.nickname, job.isTest, {
                bucketStart: job.bucketStart,
                ignoreDedupe: true,
            });
            if (!result.ok && result.classification !== 'http_4xx') {
                _enqueueFailed(job);
            }
        }
    }

    // Restaurar cola persistida y reintentar en puntos seguros de ciclo de vida.
    _failedQueue = _loadFailedQueue();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') _flushFailedQueue();
    });
    window.addEventListener('pageshow', () => { _flushFailedQueue(); });
    window.addEventListener('online', () => { _flushFailedQueue(); });

    // ── Emojis identificadores por evento (para logs de consola) ──────────────

    const EVENT_EMOJIS = {
        view_preview:             '👁️',
        click_download:           '⬇️',
        buy_item:                 '🛒',
        redeem_code:              '🎁',
        open_game:                '🎮',
        detected_error:           '🚨',
        // ── v9.9.2 ──────────────────────────────────────────────────────────
        invalid_promo_code:       '🔑',
        insufficient_funds:       '💸',
        storage_cleaned:          '🧹',
        storage_warning:          '⚠️',
        wishlist_add:             '💜',
        daily_bonus:              '🌟',
        user_snapshot:            '📊',
        sync_export:              '💾',
        // ── v11.1 — Word Hunt ───────────────────────────────────────────────
        wordsearch_content_alert: '📉',
    };

    // ── Logging condicional ───────────────────────────────────────────────────

    function _log(...args) {
        if (_debugMode) console.log('%c[GhostAnalytics]', 'color:#9b59ff;font-weight:bold', ...args);
    }

    // ── Rate limiting ─────────────────────────────────────────────────────────

    function _isRateLimited(key) {
        const now = Date.now();
        if (_lastSent[key] !== undefined && (now - _lastSent[key]) < RATE_LIMIT_MS) {
            _log('⏱ Rate limited (', Math.round((RATE_LIMIT_MS - (now - _lastSent[key])) / 1000), 's restantes):', key);
            return true;
        }
        _lastSent[key] = now;
        return false;
    }

    // ── Envío al Proxy (v12.0) ────────────────────────────────────────────────

    /**
     * Construye el payload ligero y lo envía al Proxy Serverless.
     * Fire-and-forget: el caller nunca espera. Los errores de red se loguean
     * en consola pero nunca se propagan.
     *
     * El proxy se encarga de:
     *   - Clasificar el mensaje en el Topic correcto de Telegram.
     *   - Formatear el HTML del mensaje con emojis y timestamp de servidor.
     *   - Proteger el bot token de Telegram (nunca se expone al cliente).
     *
     * @param {string}      event     Nombre del evento.
     * @param {object|null} meta      Metadatos técnicos del evento.
     * @param {string}      nickname  Nickname resuelto del jugador.
     * @param {boolean}     [isTest=false]  Omite el rate limiter en test().
     * @param {object}      [options]        Opciones internas (dedupe/retry/timestamps).
     */
    async function _send(event, meta, nickname, isTest, options) {
        const opts = options || {};
        const clientEventTs = Number.isFinite(opts.clientEventTs) ? opts.clientEventTs : Date.now();
        const bucketStart = opts.bucketStart || _bucketTs(Date.now());
        const dedupeKey = _buildDedupeKey(event, meta, bucketStart);
        if (!opts.ignoreDedupe && _dedupeLedger.has(dedupeKey)) {
            _log('🔁 Dedupe activo — evento omitido:', event, dedupeKey);
            return { ok: true, deduped: true, dedupeKey };
        }

        const emoji = EVENT_EMOJIS[event] || '📊';
        _log('→ Enviando al Proxy:', emoji, event, meta || '');

        // Payload ligero — el proxy gestiona el formateo final
        const payload = {
            type:  _resolveEventType(event),
            user:  nickname,
            event: isTest ? `${event} [TEST]` : event,
            client_event_ts: clientEventTs,
            data:  meta && Object.keys(meta).length ? meta : {},
        };

        const attemptSend = async (attempt, endpointIndex) => {
            const endpoint = _PROXY_ENDPOINTS[endpointIndex] || _PRIMARY_PROXY_ENDPOINT;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort('timeout'), _SEND_TIMEOUT_MS);
            const startedAt = performance.now();
            let timedOut = false;
            try {
                // keepalive: true — el request sobrevive a navegaciones de página
                const promise = fetch(endpoint, {
                    method:    'POST',
                    headers:   { 'Content-Type': 'application/json' },
                    body:      JSON.stringify(payload),
                    keepalive: true,
                    signal: controller.signal,
                });

                // Registrar en WeakSet ANTES de encadenar then/catch para que el
                // handler de unhandledrejection pueda identificarlo como propio.
                _pendingFetches.add(promise);
                const res = await promise;

                if (res.ok) {
                    const elapsedMs = Math.round(performance.now() - startedAt);
                    _log('✅ Entregado al Proxy:', event, `(HTTP ${res.status})`);
                    _dedupeLedger.add(dedupeKey);
                    return {
                        ok: true,
                        status: res.status,
                        attempts: attempt + 1,
                        latencyMs: elapsedMs,
                        dedupeKey,
                        classification: 'ok',
                    };
                }

                if (!res.ok) {
                    const errorBodyText = await res.text().catch(() => '');
                    const structuredHttpError = {
                        event,
                        endpoint,
                        attempt: attempt + 1,
                        online: navigator.onLine,
                        timedOut: false,
                        error: {
                            name: 'HTTPError',
                            message: `HTTP ${res.status}`,
                        },
                        response: {
                            status: res.status,
                            body: errorBodyText ? errorBodyText.slice(0, 300) : null,
                        },
                    };
                    console.warn('[GhostAnalytics] send_fail', structuredHttpError);
                }

                if (res.status >= 500 && attempt < (_SEND_MAX_ATTEMPTS - 1)) {
                    const backoff = _SEND_BACKOFF_BASE_MS * (2 ** attempt);
                    console.warn('[GhostAnalytics] Proxy HTTP 5xx:', res.status, '| Reintento en', backoff, 'ms | Endpoint:', endpoint, '| Evento:', event);
                    await _sleep(backoff);
                    return attemptSend(attempt + 1, endpointIndex);
                }

                if (res.status >= 400 && res.status <= 499) {
                    _incrementFailureCounter('http_4xx');
                    console.warn(
                        '[GhostAnalytics] ❗ Proxy HTTP 4xx:', res.status,
                        '— Evento:', event,
                        '| Error lógico / payload inválido (sin reintentos).'
                    );
                    return {
                        ok: false,
                        status: res.status,
                        attempts: attempt + 1,
                        classification: 'http_4xx',
                        error: `HTTP ${res.status}`,
                        dedupeKey,
                    };
                }

                console.warn('[GhostAnalytics] ❗ Proxy HTTP 5xx:', res.status, '| Evento:', event, '| Sin más reintentos.');
                _incrementFailureCounter('http_5xx');
                _enqueueFailed({ event, meta, nickname, isTest, bucketStart, dedupeKey });
                return {
                    ok: false,
                    status: res.status,
                    attempts: attempt + 1,
                    endpoint,
                    classification: 'http_5xx',
                    error: `HTTP ${res.status}`,
                    dedupeKey,
                };
            } catch (err) {
                timedOut = err?.name === 'AbortError';
                const offline = navigator.onLine === false;
                const cause = timedOut
                    ? 'timeout'
                    : (offline ? 'offline' : 'network');
                const humanReason = timedOut
                    ? 'Timeout agotado'
                    : (offline ? 'Red caída' : 'Fallo de red');
                console.warn('[GhostAnalytics] send_fail', {
                    event,
                    endpoint,
                    attempt: attempt + 1,
                    online: navigator.onLine,
                    timedOut,
                    error: {
                        name: err?.name || 'Error',
                        message: err?.message || String(err),
                    },
                    response: {
                        status: null,
                        body: null,
                    },
                });

                // Fallback inmediato: si falla el endpoint primario por excepción
                // de red/timeout/offline, probar de inmediato el secundario antes
                // de entrar al backoff exponencial normal.
                if (endpointIndex === 0 && _PROXY_ENDPOINTS[1]) {
                    console.warn('[GhostAnalytics] Fallback inmediato a endpoint secundario:', _PROXY_ENDPOINTS[1], '| Evento:', event);
                    return attemptSend(attempt, 1);
                }

                if (attempt < (_SEND_MAX_ATTEMPTS - 1)) {
                    const backoff = _SEND_BACKOFF_BASE_MS * (2 ** attempt);
                    console.warn(`[GhostAnalytics] ${humanReason} — reintento en ${backoff} ms | Endpoint: ${endpoint} | Evento:`, event);
                    await _sleep(backoff);
                    return attemptSend(attempt + 1, endpointIndex);
                }

                console.error(`[GhostAnalytics] ❌ ${humanReason} al enviar "${event}":`, err?.message || String(err));
                _incrementFailureCounter(cause);
                _enqueueFailed({ event, meta, nickname, isTest, bucketStart, dedupeKey });
                return {
                    ok: false,
                    status: null,
                    attempts: attempt + 1,
                    endpoint,
                    classification: cause,
                    error: err?.message || String(err),
                    dedupeKey,
                };
            } finally {
                clearTimeout(timeoutId);
            }
        };

        return attemptSend(0, 0);
    }

    // ── API pública ───────────────────────────────────────────────────────────

    /**
     * Registra un evento analítico y lo envía al Proxy /api/report.
     *
     * Flujo de validación (en orden):
     *   1. Shadow-Gate activo → descarte silencioso.
     *   2. Localhost detectado → descarte silencioso + log en debug.
     *   3. Bot user-agent detectado → descarte silencioso + log en debug.
     *   4. Human Gate cerrado → encolar en _pendingQueue (máx. 50 items).
     *   5. Nickname no disponible → encolar e iniciar nickname poller.
     *   6. Rate limit activo → descarte silencioso.
     *   7. OK → _send() con el payload { type, user, event, client_event_ts, data }.
     *
     * Uso:
     *   window.GhostAnalytics.track('view_preview',   { wallpaper: 'Cyber Neon' });
     *   window.GhostAnalytics.track('click_download', { wallpaper: 'Cyber Neon', fuente: 'biblioteca' });
     *   window.GhostAnalytics.track('buy_item',       { wallpaper: 'Cyber Neon', precio: 500, cashback: 50 });
     *   window.GhostAnalytics.track('redeem_code',    { recompensa: 1000, código: 'PVZ***' });
     *   window.GhostAnalytics.track('open_game',      { juego: 'dodge' });
     *   window.GhostAnalytics.track('detected_error', { mensaje: '...', tipo: '...' });
     *
     * Nota: 'user' NO debe pasarse en meta — se inyecta automáticamente desde localStorage.
     *
     * @param {string} event   Nombre del evento.
     * @param {object} [meta]  Metadatos opcionales (sin 'user').
     */
    function track(event, meta) {
        try {
            // ── 1. Shadow-Gate ────────────────────────────────────────────────
            if (_isShadowGated()) return;

            // ── 2. Anti-Localhost ─────────────────────────────────────────────
            if (_isLocalhost()) {
                _log('🏠 Localhost detectado — evento descartado:', event);
                return;
            }

            // ── 3. Anti-Bot ───────────────────────────────────────────────────
            if (_isBot()) {
                _log('🤖 Bot user-agent detectado — evento descartado:', event);
                return;
            }

            if (!event || typeof event !== 'string') return;

            const clientEventTs = Date.now();

            // ── 4. Human Gate ─────────────────────────────────────────────────
            if (!_humanGateUnlocked) {
                if (_pendingQueue.length < _PENDING_QUEUE_MAX) {
                    _pendingQueue.push({
                        event,
                        meta: meta || {},
                        queuedAt: Date.now(),
                        clientEventTs,
                    });
                    _log('⏳ Human Gate cerrado — evento encolado:', event,
                         `(${_pendingQueue.length}/${_PENDING_QUEUE_MAX})`);
                } else {
                    _log('⚠️ Cola pendiente llena — evento descartado:', event);
                }
                return;
            }

            // ── 5. Nickname obligatorio ───────────────────────────────────────
            const nickname = _getNickname();
            if (!nickname) {
                if (_pendingQueue.length < _PENDING_QUEUE_MAX) {
                    _pendingQueue.push({
                        event,
                        meta: meta || {},
                        queuedAt: Date.now(),
                        clientEventTs,
                    });
                    _log('👤 Sin nickname — evento encolado (poller activo):', event);
                    _startNicknamePoller();
                }
                return;
            }

            // ── 6. Rate limiting ──────────────────────────────────────────────
            const key = `${event}:${JSON.stringify(meta || {})}`;
            if (_isRateLimited(key)) return;

            // ── 7. Envío al Proxy ─────────────────────────────────────────────
            _send(event, meta || {}, nickname, false, { clientEventTs });

        } catch (err) {
            // Error interno inesperado — nunca debe romper la UI
            console.error('[GhostAnalytics] Error interno en track():', err);
        }
    }

    /**
     * Envía un evento de prueba al Proxy /api/report, saltando el rate limiter.
     * Confirma que la función serverless está activa y que el módulo funciona.
     *
     * Respeta Shadow-Gate, Anti-Localhost y Anti-Bot.
     * El campo 'user' se incluye con el nickname real o '(sin nickname)'.
     *
     * Ejecutar desde DevTools:  window.GhostAnalytics.test()
     */
    function test() {
        if (_isShadowGated()) {
            const diagnostic = {
                ok: false,
                blocked: 'shadow_gate',
                diagnosis: 'bloqueado_por_cliente',
                detail: 'Shadow-Gate activo en sessionStorage (ghost_ignore=true).',
                endpoint: _PRIMARY_PROXY_ENDPOINT,
                endpoints: _PROXY_ENDPOINTS.slice(),
            };
            console.warn(
                '%c[GhostAnalytics] 🔕 Shadow-Gate activo',
                'color:#f97316;font-weight:bold',
                '— test() bloqueado. Esta sesión está excluida de las analíticas.',
                '\n  Para desactivar: sessionStorage.removeItem(\'ghost_ignore\') y recarga.'
            );
            return Promise.resolve(diagnostic);
        }

        if (_isLocalhost()) {
            const diagnostic = {
                ok: false,
                blocked: 'localhost',
                diagnosis: 'bloqueado_por_cliente',
                detail: 'Anti-Localhost activo: envío bloqueado por diseño.',
                endpoint: _PRIMARY_PROXY_ENDPOINT,
                endpoints: _PROXY_ENDPOINTS.slice(),
            };
            console.warn(
                '%c[GhostAnalytics] 🏠 Localhost detectado',
                'color:#f97316;font-weight:bold',
                '— test() bloqueado. El Proxy no se activa en entornos locales.',
                '\n  Despliega en producción y abre con el token de Shadow-Gate para probar.'
            );
            return Promise.resolve(diagnostic);
        }

        if (_isBot()) {
            const diagnostic = {
                ok: false,
                blocked: 'bot',
                diagnosis: 'bloqueado_por_cliente',
                detail: 'Anti-Bot activo por coincidencia de user-agent.',
                endpoint: _PRIMARY_PROXY_ENDPOINT,
                endpoints: _PROXY_ENDPOINTS.slice(),
            };
            console.warn(
                '%c[GhostAnalytics] 🤖 Bot user-agent detectado',
                'color:#f97316;font-weight:bold',
                '— test() bloqueado.',
                '\n  UA:', navigator.userAgent
            );
            return Promise.resolve(diagnostic);
        }

        const nickname = _getNickname() || '(sin nickname)';
        console.log('[GhostAnalytics] Enviando evento de prueba al Proxy…');
        return _send(
            'open_game',
            { juego: '✅ TEST — Proxy activo y módulo cargado correctamente' },
            nickname,
            /* isTest= */ true
        ).then(result => {
            const diagnosis = result.ok
                ? 'ok'
                : (result.classification === 'timeout'
                    ? 'timeout'
                    : ((result.classification === 'offline' || result.classification === 'network')
                        ? 'endpoint_no_accesible'
                        : (result.classification === 'http_4xx' || result.classification === 'http_5xx'
                            ? 'error_http_backend'
                            : 'desconocido')));
            const diagnostic = {
                ok: result.ok,
                endpoint: result.endpoint || _PRIMARY_PROXY_ENDPOINT,
                endpoints: _PROXY_ENDPOINTS.slice(),
                status: result.status ?? null,
                attempts: result.attempts,
                latencyMs: result.latencyMs ?? null,
                error: result.error ?? null,
                classification: result.classification,
                diagnosis,
            };
            console.log('[GhostAnalytics] Diagnóstico test():', diagnostic);
            return diagnostic;
        });
    }

    /**
     * Activa o desactiva logs detallados en consola.
     * Al activar, resetea el rate limiter para poder re-disparar eventos
     * inmediatamente sin esperar los 3 s.
     *
     * Ejecutar desde DevTools:
     *   window.GhostAnalytics.debug(true)   // activar
     *   window.GhostAnalytics.debug(false)  // desactivar
     *
     * @param {boolean} enabled
     */
    function debug(enabled) {
        _debugMode = Boolean(enabled);
        if (_debugMode) {
            // Limpiar rate limiter para que los próximos eventos se envíen de inmediato
            Object.keys(_lastSent).forEach(k => delete _lastSent[k]);
            console.log(
                '%c[GhostAnalytics] 🔍 Modo debug ACTIVADO',
                'color:#9b59ff;font-weight:bold',
                '\n  → Rate limiter reseteado. Todos los eventos se loguearán.',
                '\n  → Human Gate:', _humanGateUnlocked ? 'ABIERTO ✅' : 'CERRADO 🔒',
                '\n  → Eventos en cola:', _pendingQueue.length,
                '\n  → Nickname detectado:', _getNickname() || '(ninguno)',
                '\n  → Localhost:', _isLocalhost(),
                '\n  → Bot UA:', _isBot(),
                '\n  → Proxy endpoints:', _PROXY_ENDPOINTS.join(' → '),
                '\n  → Desactivar con: window.GhostAnalytics.debug(false)'
            );
        } else {
            console.log('[GhostAnalytics] Modo debug desactivado.');
        }
    }

    /**
     * Muestra el estado interno del módulo en consola.
     * Incluye Shadow-Gate, Anti-Bot, Human Gate, cola pendiente, nickname y rate limiter.
     *
     * Ejecutar desde DevTools:  window.GhostAnalytics.status()
     */
    function status() {
        const now      = Date.now();
        const keys     = Object.keys(_lastSent);
        const gated    = _isShadowGated();
        const isLocal  = _isLocalhost();
        const isRobot  = _isBot();
        const nickname = _getNickname();
        const rl       = keys.map(k => {
            const remainingMs = RATE_LIMIT_MS - (now - _lastSent[k]);
            return `  · ${k}  →  ${remainingMs > 0 ? `rate-limited (${Math.ceil(remainingMs / 1000)}s)` : 'libre'}`;
        });

        const failureCountersSnapshot = { ..._failureCounters };
        console.log(
            '%c[GhostAnalytics] Estado actual (v12.0)',
            'color:#9b59ff;font-weight:bold',
            // ── Candado 0: Shadow-Gate ──
            `\n\n  🔕 Shadow-Gate: ${gated
                ? 'ACTIVO — esta sesión está excluida de las analíticas'
                : 'inactivo'}`,
            // ── Candado 1A: Localhost ──
            `\n  🏠 Anti-Localhost: ${isLocal
                ? '⛔ ACTIVO — entorno local detectado, envíos bloqueados'
                : '✅ OK — dominio de producción'}`,
            // ── Candado 1B: Bot ──
            `\n  🤖 Anti-Bot: ${isRobot
                ? '⛔ BOT DETECTADO — user-agent en blacklist'
                : '✅ OK — user-agent humano'}`,
            // ── Candado 2: Human Gate ──
            `\n  🔓 Human Gate: ${_humanGateUnlocked
                ? 'ABIERTO — actividad humana confirmada'
                : '🔒 CERRADO — esperando primera interacción (click / tecla / scroll)'}`,
            // ── Nickname ──
            `\n  👤 Nickname: ${nickname
                ? `"${nickname}" — se incluirá en todos los payloads`
                : '(no disponible) — eventos en cola hasta que el usuario configure su identidad'}`,
            // ── Cola pendiente ──
            `\n  📥 Cola pendiente: ${_pendingQueue.length} evento(s)` +
                (_nicknamePoller ? ' · Nickname poller ACTIVO ⏳' : ''),
            // ── Proxy ──
            `\n  🔗 Proxy endpoints: ${_PROXY_ENDPOINTS.join(' → ')}`,
            // ── Debug ──
            `\n  🔍 Debug mode: ${_debugMode}`,
            // ── Telemetría de fallos ──
            `\n  🧪 Fallos acumulados: timeout=${failureCountersSnapshot.timeout}, offline=${failureCountersSnapshot.offline}, network=${failureCountersSnapshot.network}, http_5xx=${failureCountersSnapshot.http_5xx}, http_4xx=${failureCountersSnapshot.http_4xx}`,
            // ── Rate limiter ──
            `\n  ⏱ Rate limiter (${keys.length} clave${keys.length !== 1 ? 's' : ''}):\n${rl.join('\n') || '  (vacío)'}`
        );

        return {
            shadowGate: gated,
            localhostBlocked: isLocal,
            botBlocked: isRobot,
            humanGateUnlocked: _humanGateUnlocked,
            nickname: nickname || null,
            pendingQueueSize: _pendingQueue.length,
            nicknamePollerActive: Boolean(_nicknamePoller),
            endpoint: _PRIMARY_PROXY_ENDPOINT,
            endpoints: _PROXY_ENDPOINTS.slice(),
            debug: _debugMode,
            failureCounters: failureCountersSnapshot,
            rateLimiterKeys: keys,
        };
    }

    // ── Captura automática de errores globales ────────────────────────────────

    /**
     * Clasifica un error según su constructor para enriquecer el mensaje de Telegram.
     * @param {Error|null} err
     * @returns {string}
     */
    function _classifyError(err) {
        if (!err) return 'Error desconocido';
        const name = err.constructor?.name || err.name || 'Error';
        const knownTypes = {
            TypeError:        'TypeError — acceso a propiedad/método inválido',
            ReferenceError:   'ReferenceError — variable no definida',
            SyntaxError:      'SyntaxError — código mal formado',
            RangeError:       'RangeError — valor fuera de rango permitido',
            URIError:         'URIError — URI malformado',
            NetworkError:     'NetworkError — fallo de red',
            AbortError:       'AbortError — petición cancelada',
            TimeoutError:     'TimeoutError — tiempo de espera agotado',
            NotFoundError:    'NotFoundError — recurso no encontrado',
            SecurityError:    'SecurityError — violación de política de seguridad'
        };
        return knownTypes[name] || name;
    }

    /**
     * Extrae el primer frame relevante del stack trace de un Error.
     * Descarta frames internos del navegador (chrome-extension://, etc.)
     * @param {Error|null} err
     * @returns {string}
     */
    function _firstStackFrame(err) {
        if (!err?.stack) return '';
        const lines = err.stack.split('\n').slice(1); // saltar la primera línea (mensaje)
        for (const line of lines) {
            const trimmed = line.trim();
            // Ignorar frames del navegador o extensiones
            if (!trimmed || trimmed.includes('chrome-extension://') ||
                trimmed.includes('extensions::')) continue;
            // Extraer solo la parte útil: "en funcion (archivo:linea:col)"
            return trimmed.replace(/^\s*at\s+/, '').slice(0, 80);
        }
        return '';
    }

    /**
     * Determina si una URL apunta a un recurso de la plataforma (no externo).
     * @param {string} url
     * @returns {boolean}
     */
    function _isLocalFile(url) {
        if (!url) return false;
        const origin = window.location.origin;
        return url.startsWith(origin) || url.startsWith('/') || url.startsWith('./');
    }

    // ── Contexto de ejecución forense (v9.9.2) ────────────────────────────────

    /**
     * Construye el contexto de ejecución forense para enriquecer los eventos
     * detected_error. Nunca lanza — envuelto en try/catch para no afectar el
     * flujo de reporte de errores.
     *
     * Campos devueltos:
     *  - url      Ruta completa (máx 120 chars), útil para reproducir el error.
     *  - online   'sí' | 'no' — distingue fallos de código de fallos de red.
     *  - mem_mb   Heap JS usado en MB (solo Chrome/Edge; omitido en otros).
     *  - vista    Vista SPA activa ('home' | 'shop') como breadcrumb.
     *
     * @returns {object}
     */
    function _getExecutionContext() {
        try {
            const ctx = {};

            // Ruta completa — permite reproducir el error en el mismo contexto
            const href = window.location.href;
            ctx.url = href.length > 120 ? href.slice(0, 117) + '…' : href;

            // Estado de red — si offline, el error probablemente es de red, no de código
            ctx.online = navigator.onLine ? 'sí' : 'no';

            // Memoria JS (Chrome/Edge únicamente; performance.memory es no-estándar)
            // Útil para detectar fugas de memoria en gama baja que provoquen crashes.
            const mem = performance?.memory;
            if (mem?.usedJSHeapSize) {
                ctx.mem_mb = (mem.usedJSHeapSize / 1_048_576).toFixed(1) + ' MB';
            }

            // Vista SPA activa: breadcrumb que indica dónde estaba el usuario
            const view = window.SpaRouter?.getCurrentView?.();
            if (view) ctx.vista = view;

            return ctx;
        } catch (_) {
            return {}; // Nunca propagar un error desde el sistema de errores
        }
    }

    // ── Handler: errores síncronos (window.onerror) ───────────────────────────
    //
    // Los errores globales también pasan por track(), que aplicará el Doble
    // Candado completo. Esto significa que los errores generados por bots,
    // en localhost, o antes de que haya actividad humana, quedan retenidos
    // o descartados según las reglas de la criba. El comportamiento es correcto:
    // los errores de entornos controlados no deben saturar el Topic de Bugs.
    //
    window.addEventListener('error', (e) => {
        try {
            // Shadow-Gate: silenciar también los handlers de error globales
            if (_isShadowGated()) return;

            const err  = e.error;
            const tipo = _classifyError(err);
            const frame = _firstStackFrame(err);

            // Filtrar errores de recursos externos (imágenes, CDN, etc.)
            // El evento 'error' con e.target !== window es un error de carga de recurso,
            // no un error de JS — no es relevante para analytics.
            if (e.target && e.target !== window) return;

            const meta = {
                tipo:    tipo.slice(0, 60),
                mensaje: (e.message || 'sin mensaje').slice(0, 120)
            };

            // Añadir archivo solo si es un fichero de la plataforma (no CDN externo)
            const archivo = (e.filename || '').split('/').pop();
            if (archivo) meta.archivo = `${archivo}:${e.lineno || '?'}`;

            // Añadir stack frame si aporta contexto
            if (frame) meta.stack = frame;

            // [v9.9.2] Contexto forense: url, online, mem_mb, vista
            Object.assign(meta, _getExecutionContext());

            track('detected_error', meta);
        } catch (_) { /* nunca propagar */ }
    });

    // ── Handler: promesas rechazadas sin capturar ─────────────────────────────
    window.addEventListener('unhandledrejection', (e) => {
        try {
            // Shadow-Gate: silenciar también los handlers de error globales
            if (_isShadowGated()) return;

            // Evitar feedback loop: ignorar rechazos que vienen de nuestros propios fetchs
            if (_pendingFetches.has(e.promise)) return;

            const reason = e.reason;
            let mensaje, tipo;

            if (reason instanceof Error) {
                tipo    = _classifyError(reason);
                mensaje = reason.message || 'sin mensaje';
            } else if (typeof reason === 'string') {
                tipo    = 'Rejection string';
                mensaje = reason;
            } else if (reason === null || reason === undefined) {
                tipo    = 'Rejection vacía';
                mensaje = 'Promise rechazada sin motivo';
            } else {
                tipo    = 'Rejection object';
                mensaje = JSON.stringify(reason).slice(0, 100);
            }

            // "Failed to fetch": añadir contexto de la página actual
            if (mensaje.includes('Failed to fetch') || mensaje.includes('NetworkError')) {
                tipo    = 'NetworkError — fallo de red o CSP';
                mensaje = `${mensaje} (página: ${window.location.pathname})`;
            }

            const meta = {
                tipo:    tipo.slice(0, 80),
                mensaje: mensaje.slice(0, 120)
            };

            // Stack del reason si está disponible
            const frame = _firstStackFrame(reason instanceof Error ? reason : null);
            if (frame) meta.stack = frame;

            // [v9.9.2] Contexto forense: url, online, mem_mb, vista
            Object.assign(meta, _getExecutionContext());

            track('detected_error', meta);
        } catch (_) { /* nunca propagar */ }
    });

    function initGameOpenTracking() {
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[href*="games/"]');
            if (!link) return;
            const gameId = link.dataset.gameId
                || link.dataset.gameName
                || link.getAttribute('href')?.split('/').pop()?.replace(/\.html?$/, '')
                || 'desconocido';
            track('open_game', { juego: gameId });
        }, { passive: true });
    }

    // ── Confirmación de carga ─────────────────────────────────────────────────
    // Este log es el primer punto de diagnóstico: si no aparece, el <script>
    // no está incluido en index.html o hay un error de sintaxis en el módulo.
    (function _printLoadMessage() {
        const isLocal = _isLocalhost();
        const isRobot = _isBot();
        const gated   = _isShadowGated();
        const hasNick = Boolean(_getNickname());

        if (gated) {
            console.log(
                '%c[GhostAnalytics] 🔕 Módulo cargado en modo silencioso (v12.0) — Shadow-Gate activo.',
                'color:#f97316;font-weight:bold',
                '| Esta sesión está excluida de las analíticas.',
                '| status(): ver estado | debug(true): activar logs'
            );
        } else if (isLocal) {
            console.log(
                '%c[GhostAnalytics] 🏠 Módulo cargado (v12.0) — LOCALHOST detectado.',
                'color:#f97316;font-weight:bold',
                '| Todos los envíos están bloqueados en entorno local.',
                '| status(): ver estado | debug(true): activar logs'
            );
        } else if (isRobot) {
            console.log(
                '[GhostAnalytics] 🤖 Módulo cargado (v12.0) — Bot UA detectado. Envíos bloqueados.'
            );
        } else {
            console.log(
                '[GhostAnalytics] ✅ Módulo listo (v12.0).',
                '| Human Gate:', hasNick ? 'ABIERTO (nickname existente) 🔓' : 'EN ESPERA (primera interacción) 🔒',
                '| Proxy:', _PROXY_ENDPOINTS.join(' → '),
                '| test(): probar Proxy',
                '| debug(true): activar logs',
                '| status(): ver estado interno'
            );
        }
    })();

    // ── Exposición global ─────────────────────────────────────────────────────
    window.GhostAnalytics = Object.freeze({ track, test, debug, status, initGameOpenTracking });

})();
