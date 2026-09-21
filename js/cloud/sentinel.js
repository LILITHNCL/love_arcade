// Debe cargarse después de core/config.js y core/state-store.js, y antes de los módulos de dominio.
// Instala el interceptor de localStorage para las claves vigiladas de Sentinel.
// =====================================================
// ☁️  SENTINEL CLOUD SYNC — v14.0
// ─────────────────────────────────────────────────────────────────────────────
// Arquitectura: Patrón "Sentinel" (Observador)
//
// El Sentinel actúa como una capa de persistencia en la nube que espeja el
// localStorage sin modificar el código de los juegos. Todos los minijuegos
// corren bajo el mismo origen (subcarpetas), por lo que comparten acceso al
// mismo localStorage. El Sentinel observa cambios en las claves críticas,
// los empaqueta en un objeto JSONB y los sube a Supabase con debounce.
//
// Flujo principal:
//  1. init: obtiene credenciales de /api/client-config → crea cliente Supabase
//  2. onAuthStateChange: detecta sesión activa (Email/Password)
//     → al SIGNED_IN: descarga perfil de la nube y aplica Last Write Wins
//  3. StorageInterceptor: intercepta localStorage.setItem para claves vigiladas
//     → dispara _sentinelScheduleSync() con debounce de 3 s
//  4. _sentinelSync(): sube snapshot de todas las claves vigiladas a Supabase
//
// Resolución de conflictos — Last Write Wins (timestamp):
//  · Al iniciar sesión se compara updated_at de la BD con la marca local.
//  · Si la nube es más reciente, se sobreescribe el localStorage local.
//  · Si el local es más reciente (o igual), la nube se actualiza al subir.
//
// Claves vigiladas (SENTINEL_WATCHED_KEYS):
//  Hub:            gamecenter_v6_promos
//  Word Hunt:      la_ws_completedLevels, la_ws_state
//  Rompecabezas:   puz_arcade_progress, puz_arcade_unlocked
//  2048 Lumina:    LUMINA_bestScore, LUMINA_gameState
//  Space Shooter:  la_shooter_highscore, la_shooter_settings
//  Ollin Smash:    OS_highscore
//  Jungle Dash:    JD_highscore, JD_muted
//  Dodger:         dodger_highscore, dodger_skin, dodger_muted
//  Marejig:        MAREJIG_completedLevels_v1, MAREJIG_levelProgress_v1,
//                  MAREJIG_activeSave_v1, MAREJIG_settings_v1
//
// Supabase SQL (ejecutar una sola vez en el editor de Supabase):
// ─────────────────────────────────────────────────────────────────────────────
//  create table user_profiles (
//    id          uuid references auth.users primary key,
//    game_data   jsonb not null default '{}',
//    updated_at  timestamptz not null default now()
//  );
//  alter table user_profiles enable row level security;
//  create policy "own_select" on user_profiles for select  using (auth.uid()=id);
//  create policy "own_insert" on user_profiles for insert  with check (auth.uid()=id);
//  create policy "own_update" on user_profiles for update  using (auth.uid()=id);
// =====================================================

(function SentinelCloudSync() {
    'use strict';

    // ── Claves a observar y sincronizar ──────────────────────────────────────
    const SENTINEL_WATCHED_KEYS = new Set([
        'gamecenter_v6_promos',    // Hub principal — monedas, inventario, racha
        'la_ws_completedLevels',   // Word Hunt — niveles completados
        'la_ws_state',             // Word Hunt — estado de sesión
        'puz_arcade_progress',     // Rompecabezas — progreso
        'puz_arcade_unlocked',     // Rompecabezas — niveles desbloqueados
        'LUMINA_bestScore',        // 2048 Lumina — mejor puntuación
        'LUMINA_gameState',        // 2048 Lumina — estado de partida
        'la_shooter_highscore',    // Space Shooter — récord
        'la_shooter_settings',     // Space Shooter — configuración
        'OS_highscore',            // Ollin Smash — récord
        'JD_highscore',            // Jungle Dash — récord
        'JD_muted',                // Jungle Dash — silencio
        'dodger_highscore',        // Dodger — récord
        'dodger_skin',             // Dodger — skin activa
        'dodger_muted',            // Dodger — silencio
        'MAREJIG_completedLevels_v1', // Marejig — niveles completados y métricas finales
        'MAREJIG_levelProgress_v1',   // Marejig — resumen ligero por nivel pendiente
        'MAREJIG_activeSave_v1',      // Marejig — partida activa compacta
        'MAREJIG_settings_v1',        // Marejig — preferencias locales
    ]);

    // Clave del registro de marca de tiempo local (para Last Write Wins)
    const SENTINEL_TS_KEY = 'love_arcade_sentinel_ts';

    // Tabla de Supabase
    const SUPABASE_TABLE = 'user_profiles';

    // Estado interno del Sentinel
    let _sbClient   = null;   // Cliente Supabase inicializado
    let _sbSession  = null;   // Sesión de usuario activa
    let _syncTimer  = null;   // Timer de debounce
    let _scheduledSyncPriority = null; // 'high' | 'passive' | null
    let _isSyncing  = false;  // Mutex de subida activa
    let _isRestoringSession = false; // Evita sobrescrituras durante hidratación inicial
    let _hasUnsyncedChanges = false; // Dirty flag local (incluye cambios cross-tab)
    const HIGH_PRIORITY_DEBOUNCE_MS = 1_000;
    const PASSIVE_PRIORITY_DEBOUNCE_MS = 60_000;

    const HIGH_PRIORITY_KEYS = new Set([
        window.CONFIG.stateKey,              // gamecenter_v6_promos
        'gamecenter_v6_promos',
        'love_arcade_inventory',
        'LUMINA_bestScore',
        'love_arcade_settings',
        'MAREJIG_completedLevels_v1',
    ]);

    const PASSIVE_PRIORITY_KEYS = new Set([
        'LUMINA_gameState',
        'MAREJIG_levelProgress_v1',
        'MAREJIG_activeSave_v1',
        'MAREJIG_settings_v1',
        SENTINEL_TS_KEY,
    ]);

    function _getCloudAvatarUrl() {
        try {
            const avatar = window.GameCenter?.getAvatar?.();
            if (typeof avatar !== 'string') return null;
            if (window.LoveArcadeStore.isBase64Avatar(avatar)) return null;
            return /^https?:\/\//i.test(avatar) ? avatar : null;
        } catch (_) {
            return null;
        }
    }

    // ── Utilidades de UI ─────────────────────────────────────────────────────

    function _setStatusBadge(state) {
        const dot  = document.getElementById('cloud-status-dot');
        const text = document.getElementById('cloud-status-text');
        const badge = document.getElementById('cloud-status-badge');
        if (!dot || !text) return;

        const STATES = {
            inactive:  { color: 'var(--text-low)',  label: 'Inactivo' },
            connected: { color: '#63b3ed',           label: 'Conectado' },
            syncing:   { color: '#f6ad55',           label: 'Sincronizando…' },
            synced:    { color: '#68d391',           label: 'Sincronizado' },
            error:     { color: '#fc8181',           label: 'Error' },
        };
        const s = STATES[state] || STATES.inactive;
        dot.style.background = s.color;
        text.textContent     = s.label;
        if (badge) badge.style.color = s.color;
    }

    function _setLoginMsg(msg, isError = false) {
        const el = document.getElementById('cloud-login-msg');
        if (!el) return;
        el.textContent  = msg;
        el.style.color  = isError ? 'var(--error, #fc8181)' : '#68d391';
    }

    function _setSyncMsg(msg, isError = false) {
        const el = document.getElementById('cloud-sync-msg');
        if (!el) return;
        el.textContent = msg;
        el.style.color = isError ? 'var(--error, #fc8181)' : '#68d391';
    }

    function _setLastSyncLabel(isoStr) {
        const el = document.getElementById('cloud-last-sync');
        if (!el) return;
        if (!isoStr) {
            el.textContent = 'Última sincronización: —-';
            return;
        }
        const d = new Date(isoStr);
        el.textContent = `Última sincronización: ${d.toLocaleString('es-MX', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        })}`;
    }

    function _setAccountStateLabel(isOnline) {
        const el = document.getElementById('cloud-account-state');
        if (!el) return;
        el.textContent = isOnline ? 'Estado: En línea' : 'Estado: Sin sesión';
        el.style.color = isOnline ? '#68d391' : 'var(--text-low)';
    }

    function _setSessionEmail(email) {
        const el = document.getElementById('cloud-session-email');
        if (el) el.textContent = email || '';
    }

    // ── Snapshot — lectura/escritura del estado vigilado ─────────────────────

    /**
     * Lee todas las claves vigiladas del localStorage y las empaqueta
     * en un objeto plano { key: value_string }.
     * El valor se almacena como string (igual que localStorage).
     */
    function _buildSnapshot() {
        const snap = {};
        SENTINEL_WATCHED_KEYS.forEach(key => {
            const val = localStorage.getItem(key);
            if (val === null) return;

            // Evitar subir userAvatar dentro de game_data:
            // el avatar cloud vive en user_profiles.avatar_url y el binario en Storage.
            if ((key === window.CONFIG.stateKey || key === 'gamecenter_v6_promos') && typeof val === 'string') {
                // El estado no suele incluir un avatar Base64. En esos casos se
                // conserva el payload ya serializado y se evita parsearlo y
                // serializarlo de nuevo durante cada sincronización.
                const hasUserAvatar = val.indexOf('"userAvatar"') !== -1;
                const hasNullUserAvatar = /"userAvatar"\s*:\s*null(?:\s*[,}])/.test(val);
                if (!hasUserAvatar || hasNullUserAvatar) {
                    snap[key] = val;
                    return;
                }
                try {
                    const parsed = JSON.parse(val);
                    if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'userAvatar')) {
                        const sanitized = { ...parsed };
                        delete sanitized.userAvatar;
                        snap[key] = JSON.stringify(sanitized);
                        return;
                    }
                } catch (_) {
                    // Si no es JSON válido, se conserva el valor tal cual.
                }
            }
            snap[key] = val;
        });
        return snap;
    }

    /**
     * Escribe un snapshot (recibido de la nube) en el localStorage local.
     * Solo toca las claves que están en SENTINEL_WATCHED_KEYS y que
     * están presentes en el snapshot. No borra claves ausentes.
     *
     * IMPORTANTE: usa el setItem ORIGINAL (pre-interceptor) para no
     * disparar el debounce mientras aplicamos datos de la nube.
     */
    function _applySnapshot(snap) {
        if (!snap || typeof snap !== 'object') return;
        SENTINEL_WATCHED_KEYS.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(snap, key) && snap[key] !== null) {
                _originalSetItem(key, snap[key]);
            }
        });
        _rehydrateHubStoreFromDisk();
        // Emitir evento para que los módulos sepan que el store fue reemplazado
        document.dispatchEvent(new CustomEvent('la:cloudsynced', { detail: { source: 'cloud' } }));
    }

    function _rehydrateHubStoreFromDisk() {
        try {
            const raw = localStorage.getItem(window.CONFIG.stateKey);
            if (raw) {
                window.LoveArcadeStore.replaceStore(window.LoveArcadeStore.migrate(JSON.parse(raw)), { notifyUI: false, notifyCloud: false });
                window.GameCenter?.syncUI?.();
            }
        } catch (_) {}
    }

    // ── Sincronización hacia la nube ──────────────────────────────────────────

    /**
     * Sincroniza el snapshot local hacia Supabase cuando existe sesión activa.
     * Flujo: snapshot local -> upsert en user_profiles -> marca de tiempo local -> refresco UI.
     * @returns {Promise<void>}
     */
    async function _sentinelSync() {
        if (!_sbClient || !_sbSession || _isRestoringSession) return;
        if (_isSyncing) return; // Evitar doble subida simultánea
        _isSyncing = true;
        _setStatusBadge('syncing');

        try {
            const snap       = _buildSnapshot();
            const now        = new Date().toISOString();
            const userId     = _sbSession.user.id;
            const nickname   = window.GameCenter?.getIdentity?.()?.nickname || '';
            const avatar_url = _getCloudAvatarUrl();

            const { error } = await _sbClient
                .from(SUPABASE_TABLE)
                .upsert(
                    { id: userId, game_data: snap, nickname, avatar_url, updated_at: now },
                    { onConflict: 'id' }
                );

            if (error) throw error;

            // Guardar marca de tiempo local
            _originalSetItem(SENTINEL_TS_KEY, now);
            _setStatusBadge('synced');
            _setSyncMsg('¡Progreso guardado en la nube! ✓');
            _setLastSyncLabel(now);
            _hasUnsyncedChanges = false;
            document.dispatchEvent(new CustomEvent('la:synced', {
                detail: { at: now, source: 'sentinel-upsert' }
            }));

            // Limpiar mensaje tras 4 s
            setTimeout(() => _setSyncMsg(''), 4_000);
        } catch (err) {
            console.error('[Sentinel] Error al sincronizar:', err);
            _setStatusBadge('error');
            _setSyncMsg('Error al sincronizar. Reintentando…', true);
            // Reintentar en 30 s
            setTimeout(() => _sentinelScheduleSync(0), 30_000);
        } finally {
            _isSyncing = false;
        }
    }

    /**
     * Programa una sincronización con debounce.
     * Cada llamada reinicia el timer; la subida ocurre sólo cuando el
     * usuario lleva `delay` ms sin escribir en localStorage.
     * @param {number} [delay=HIGH_PRIORITY_DEBOUNCE_MS]
     */
    function _sentinelScheduleSync(delay = HIGH_PRIORITY_DEBOUNCE_MS) {
        if (!_sbSession || _isRestoringSession) return;
        clearTimeout(_syncTimer);
        if (document.hidden) {
            _sentinelSync();
            return;
        }
        _scheduledSyncPriority = delay <= HIGH_PRIORITY_DEBOUNCE_MS ? 'high' : 'passive';
        _syncTimer = setTimeout(() => {
            _syncTimer = null;
            _scheduledSyncPriority = null;
            _sentinelSync();
        }, delay);
    }

    function _resolveSyncPriority(key) {
        if (HIGH_PRIORITY_KEYS.has(key)) return 'high';
        if (PASSIVE_PRIORITY_KEYS.has(key)) return 'passive';
        return 'passive'; // resto de claves vigiladas
    }

    function _sentinelScheduleSyncForKey(key) {
        if (!_sbSession) return;
        const priority = _resolveSyncPriority(key);
        if (priority === 'high') {
            _sentinelScheduleSync(HIGH_PRIORITY_DEBOUNCE_MS);
            return;
        }
        // Prioridad pasiva: sólo programar si no hay sync pendiente.
        if (_syncTimer) return;
        _sentinelScheduleSync(PASSIVE_PRIORITY_DEBOUNCE_MS);
    }

    // ── Carga/merge desde la nube — Sentinel v14.0 ──────────────────────────

    async function _handleAuthChange(event, session) {
        if (!_sbClient) return;

        if (!session) {
            _sbSession = null;
            _setStatusBadge('inactive');
            _setSessionEmail('');
            clearTimeout(_syncTimer);
            return;
        }

        _sbSession = session;
        _isRestoringSession = true;
        _setSessionEmail(session.user?.email || '');
        _setStatusBadge('connected');

        try {
            const userId = session.user.id;
            const { data, error } = await _sbClient
                .from(SUPABASE_TABLE)
                .select('game_data, updated_at, nickname, avatar_url')
                .eq('id', userId)
                .maybeSingle();
            if (error) throw error;

            if (data?.nickname && !window.GameCenter?.hasIdentity?.()) {
                window.GameCenter?.setIdentity?.(data.nickname, '@');
            }
            if (data?.avatar_url && typeof data.avatar_url === 'string') {
                const avatar = data.avatar_url.trim();
                if (avatar) {
                    window.LoveArcadeStore.getStore().userAvatar = avatar;
                    window.LoveArcadeStore.save();
                }
            }

            const effectiveData = data?.game_data || {};

            const localRawTs = localStorage.getItem(SENTINEL_TS_KEY);
            const _safeTs = (iso) => {
                const t = iso ? new Date(iso).getTime() : 0;
                return Number.isFinite(t) ? t : 0;
            };
            const localTime = _safeTs(localRawTs);
            const cloudTime = _safeTs(data?.updated_at);
            const localSnapshot = _buildSnapshot();
            const hasLocalSnapshot = Object.keys(localSnapshot).length > 0;
            const hasCloudSnapshot = effectiveData && Object.keys(effectiveData).length > 0;
            const snapshotsDiffer = hasLocalSnapshot && hasCloudSnapshot
                && JSON.stringify(localSnapshot) !== JSON.stringify(effectiveData);

            if (hasCloudSnapshot && cloudTime > localTime) {
                _applySnapshot(effectiveData);
                _originalSetItem(SENTINEL_TS_KEY, data.updated_at);
                _setLastSyncLabel(data.updated_at);
                _setSyncMsg('Progreso cloud restaurado (más reciente) ✓');
                setTimeout(() => _setSyncMsg(''), 4_000);
            } else if (hasLocalSnapshot && (!hasCloudSnapshot || localTime > cloudTime || (localTime === cloudTime && snapshotsDiffer))) {
                await _sentinelSync();
            } else if (hasCloudSnapshot) {
                _setLastSyncLabel(data?.updated_at || localRawTs);
            }

            _setAccountStateLabel(true);
            _setStatusBadge('synced');
            document.dispatchEvent(new CustomEvent('la:cloud-authenticated'));
        } catch (err) {
            console.error('[Sentinel] Error al procesar auth change:', err);
            _setStatusBadge('error');
            _setSyncMsg('No se pudo sincronizar al iniciar sesión.', true);
        } finally {
            _isRestoringSession = false;
            if (_sbSession && _hasUnsyncedChanges) {
                _sentinelScheduleSync(PASSIVE_PRIORITY_DEBOUNCE_MS);
            }
        }
    }

    // ── StorageInterceptor ────────────────────────────────────────────────────

    // Referencias a los métodos ORIGINALES antes de ser interceptados.
    // _originalSetItem se usa en _applySnapshot() para evitar re-disparar el debounce.
    const _originalSetItem = localStorage.setItem.bind(localStorage);
    const _originalRemoveItem = localStorage.removeItem.bind(localStorage);

    function _markWatchedKeyDirty(key, prevValue = null, nextValue = null) {
        if (!SENTINEL_WATCHED_KEYS.has(key) || !_sbSession || _isRestoringSession) return;
        _hasUnsyncedChanges = true;
        _originalSetItem(SENTINEL_TS_KEY, new Date().toISOString());
        _sentinelScheduleSyncForKey(key);
    }

    /**
     * Intercepta localStorage.setItem.
     * Si la clave pertenece a SENTINEL_WATCHED_KEYS y hay sesión activa,
     * programa una sincronización con debounce.
     * El valor se escribe normalmente en localStorage independientemente.
     */
    localStorage.setItem = function interceptedSetItem(key, value) {
        const prevValue = localStorage.getItem(key);
        _originalSetItem(key, value);
        _markWatchedKeyDirty(key, prevValue, value);
    };

    /**
     * Intercepta localStorage.removeItem para que los borrados de claves
     * vigiladas también lleguen a la nube. Esto es especialmente importante
     * para guardados transitorios como MAREJIG_activeSave_v1, que se elimina
     * al completar, reiniciar o reemplazar una partida.
     */
    localStorage.removeItem = function interceptedRemoveItem(key) {
        const prevValue = localStorage.getItem(key);
        _originalRemoveItem(key);
        _markWatchedKeyDirty(key, prevValue, null);
    };

    // ── Cross-tab bridge: detectar writes desde otras pestañas ───────────────
    // El evento 'storage' NO se dispara en la pestaña que ejecuta setItem,
    // sólo en el resto de pestañas del mismo origen (ej: Hub abierto + juego).
    window.addEventListener('storage', (event) => {
        if (!event?.key) return;
        if (event.key === window.CONFIG.stateKey) {
            _rehydrateHubStoreFromDisk();
        }
        if (!SENTINEL_WATCHED_KEYS.has(event.key)) return;
        _rehydrateHubStoreFromDisk();
        _originalSetItem(SENTINEL_TS_KEY, new Date().toISOString());
        _hasUnsyncedChanges = true;
        if (!_sbSession || _isRestoringSession) return; // Invitado o sesión no restaurada → ignorar sync cloud
        console.log(`[Sentinel] Cambio detectado en pestaña externa (${event.key}). Sincronizando...`);
        _sentinelScheduleSyncForKey(event.key);
    });

    // ── Autenticación — onAuthStateChange ────────────────────────────────────

    function _handleSignOut() {
        _sbSession = null;
        _isRestoringSession = false;
        _hasUnsyncedChanges = false;
        _setStatusBadge('inactive');
        _setSessionEmail('');
        _setAccountStateLabel(false);
        clearTimeout(_syncTimer);
        document.dispatchEvent(new CustomEvent('la:cloud-signedout'));
    }

    // ── Inicialización ────────────────────────────────────────────────────────

    async function _sentinelInit() {
        // 1. Obtener credenciales desde el proxy seguro
        let supabaseUrl, supabaseKey;
        try {
            const res = await fetch('/api/client-config', { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const cfg = await res.json();
            supabaseUrl = cfg.supabaseUrl;
            supabaseKey = cfg.supabaseKey;
        } catch (err) {
            console.warn('[Sentinel] No se pudieron obtener credenciales de nube:', err.message);
            return; // Degradación elegante — funciona sin nube
        }

        if (!supabaseUrl || !supabaseKey) {
            console.warn('[Sentinel] Variables de entorno de Supabase no configuradas en Vercel.');
            return;
        }

        // 2. Crear cliente Supabase
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            console.warn(
                '[Sentinel] SDK de Supabase no disponible (SDK no cargada / bloqueada). ' +
                'Sentinel continuará en estado degradado (solo almacenamiento local).'
            );
            return;
        }
        try {
            _sbClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        } catch (err) {
            console.error('[Sentinel] Error creando cliente Supabase:', err);
            return;
        }

        // 3. Escuchar cambios de sesión
        _sbClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                _handleSignOut();
                return;
            }
            _handleAuthChange(event, session);
        });

        // 4. Recuperar sesión existente (para recargas de página)
        const { data: { session } } = await _sbClient.auth.getSession();
        if (session && !_sbSession) _handleAuthChange('INITIAL_SESSION', session);
    }

    // ── Listeners de UI ──────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        const gateModal = document.getElementById('cloud-gatekeeper-modal');
        const gateBox = gateModal?.querySelector('.cloud-gatekeeper-modal-box');
        const gateMsgEl = document.getElementById('cloud-gatekeeper-msg');
        const gatePanels = Array.from(document.querySelectorAll('[data-gate-panel]'));
        const loginForm = document.getElementById('cloud-login-form');
        let gateLocked = false;

        const bindPasswordToggle = () => {
            document.querySelectorAll('[data-password-toggle]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const input = document.getElementById(btn.dataset.passwordToggle || '');
                    if (!input) return;
                    input.type = input.type === 'password' ? 'text' : 'password';
                });
            });
        };
        bindPasswordToggle();

        const simplifyGateError = (rawMsg = '') => {
            const msg = String(rawMsg || '').toLowerCase();
            if (!msg) return 'No se pudo completar la acción. Inténtalo de nuevo.';
            if (msg.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
            if (msg.includes('email not confirmed')) return 'Revisa tu correo y confirma tu cuenta para continuar.';
            if (msg.includes('network') || msg.includes('fetch')) return 'Sin conexión. Revisa internet e inténtalo de nuevo.';
            if (msg.includes('rate limit') || msg.includes('too many requests')) return 'Demasiados intentos. Espera un momento y vuelve a intentar.';
            return 'No se pudo completar la acción. Inténtalo de nuevo.';
        };

        const setGateMsg = (msg, isError = false) => {
            if (!gateMsgEl) return;
            const cleanMsg = isError ? simplifyGateError(msg) : String(msg || '');
            gateMsgEl.textContent = cleanMsg;
            gateMsgEl.style.color = isError ? 'var(--error, #fc8181)' : '#68d391';
        };

        const setFormEnabled = (formEl, enabled) => {
            if (!formEl) return;
            formEl.querySelectorAll('input, button, select, textarea').forEach((control) => {
                control.disabled = !enabled;
            });
        };

        const resetGateFeedback = () => {
            setGateMsg('');
        };

        /**
         * Controla el panel de login del Gatekeeper.
         * @param {'login'} mode - Modo activo del modal.
         * @returns {void}
         */
        const renderGateMode = (mode) => {
            const selectedMode = mode || 'login';
            resetGateFeedback();
            gatePanels.forEach(panel => {
                const active = panel.dataset.gatePanel === selectedMode;
                panel.classList.toggle('is-active', active);
                panel.setAttribute('aria-hidden', String(!active));
                setFormEnabled(panel, active);
            });
        };

        const openGate = ({ mode = 'login', locked = false } = {}) => {
            gateLocked = locked;
            gateModal?.classList.remove('hidden');
            window.ModalA11y?.open?.(gateModal, document.activeElement);
            gateBox?.classList.toggle('is-locked', gateLocked);
            renderGateMode(mode);
        };

        const btnOpenGate = document.getElementById('btn-cloud-open-gatekeeper');
        btnOpenGate?.addEventListener('click', () => {
            _startSentinelBoot();
            openGate({ mode: 'login' });
        });

        const closeGate = () => {
            if (gateLocked) return;
            gateModal?.classList.add('hidden');
            window.ModalA11y?.close?.(gateModal);
            renderGateMode('login');
        };
        document.getElementById('cloud-gatekeeper-close')?.addEventListener('click', closeGate);
        gateModal?.addEventListener('click', (e) => {
            if (e.target === gateModal && !gateLocked) closeGate();
        });

        loginForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!_sbClient) {
                setGateMsg('Preparando servicio…');
                await _startSentinelBoot();
                if (!_sbClient) return setGateMsg('Servicio no disponible. Recarga la página.', true);
            }

            const email = document.getElementById('cloud-login-email')?.value?.trim();
            const password = document.getElementById('cloud-login-password')?.value || '';
            if (!email || !password) return setGateMsg('Completa correo y contraseña.', true);

            setGateMsg('Iniciando sesión…');
            try {
                const { error } = await _sbClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                setGateMsg('¡Listo! Iniciaste sesión.');
                _setLoginMsg(`Sesión iniciada para ${email}.`);
                closeGate();
            } catch (err) {
                setGateMsg(err?.message, true);
            }
        });

        const cloudIndicator = document.getElementById('cloud-sync-indicator')
            || document.getElementById('hud-cloud-sync-indicator');
        if (cloudIndicator) {
            document.addEventListener('la:synced', () => {
                cloudIndicator.classList.add('is-active', 'is-pulse');
                setTimeout(() => cloudIndicator.classList.remove('is-pulse'), 1800);
            });
        }

        window.addEventListener('pagehide', () => {
            if (!_sbSession || !_hasUnsyncedChanges) return;
            clearTimeout(_syncTimer);
            _sentinelSync();
        });

        window.addEventListener('beforeunload', () => {
            if (!_sbSession || !_hasUnsyncedChanges) return;
            clearTimeout(_syncTimer);
            _sentinelSync();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden || !_sbSession || !_hasUnsyncedChanges) return;
            clearTimeout(_syncTimer);
            _sentinelSync();
        });

        document.addEventListener('la:cloud-authenticated', () => {
            gateLocked = false;
            gateBox?.classList.remove('is-locked');
            closeGate();
        });

        _setLastSyncLabel(localStorage.getItem(SENTINEL_TS_KEY));
        _setAccountStateLabel(Boolean(_sbSession));

        const hasLocalIdentity = window.GameCenter?.hasIdentity?.();
        if (!hasLocalIdentity && !_sbSession) {
            openGate({ locked: true, mode: 'login' });
        }
    });

    // ── Arranque ─────────────────────────────────────────────────────────────
    // Espera explícitamente a que el loader de Supabase confirme createClient
    // antes de invocar _sentinelInit(), evitando un init prematuro en degradado.
    async function _bootSentinel() {
        if (!window.supabase?.createClient && typeof window.__loadSupabaseSdk === 'function') {
            try {
                await window.__loadSupabaseSdk();
            } catch (err) {
                console.warn('[Sentinel] Loader Supabase devolvió error durante bootstrap:', err);
            }
        }

        if (!window.supabase?.createClient) {
            console.warn(
                '[Sentinel] Supabase SDK no está disponible tras bootstrap (CDN primario + fallback). ' +
                'Se omite _sentinelInit() y Sentinel queda en modo degradado.'
            );
            return;
        }

        await _sentinelInit();
    }

    // El SDK y la restauración de sesión no forman parte del primer paint. Se
    // difieren hasta idle, pero una interacción con el Gatekeeper los inicia
    // enseguida para que el login temprano no espere al timeout.
    const SENTINEL_BOOT_IDLE_TIMEOUT_MS = 1800;
    let _sentinelBootPromise = null;
    let _sentinelBootIdleHandle = null;
    let _sentinelBootIdleUsesRequestIdleCallback = false;

    function _startSentinelBoot() {
        if (_sentinelBootIdleHandle !== null) {
            if (_sentinelBootIdleUsesRequestIdleCallback) {
                window.cancelIdleCallback?.(_sentinelBootIdleHandle);
            } else {
                clearTimeout(_sentinelBootIdleHandle);
            }
            _sentinelBootIdleHandle = null;
            _sentinelBootIdleUsesRequestIdleCallback = false;
        }

        if (_sentinelBootPromise) return _sentinelBootPromise;

        _sentinelBootPromise = _bootSentinel().catch(err => {
            console.error('[Sentinel] Error en inicialización:', err);
        });
        return _sentinelBootPromise;
    }

    function _scheduleSentinelBoot() {
        const runBoot = () => {
            _sentinelBootIdleHandle = null;
            _sentinelBootIdleUsesRequestIdleCallback = false;
            _startSentinelBoot();
        };

        if ('requestIdleCallback' in window) {
            _sentinelBootIdleUsesRequestIdleCallback = true;
            _sentinelBootIdleHandle = window.requestIdleCallback(runBoot, {
                timeout: SENTINEL_BOOT_IDLE_TIMEOUT_MS
            });
            return;
        }

        _sentinelBootIdleHandle = setTimeout(runBoot, SENTINEL_BOOT_IDLE_TIMEOUT_MS);
    }

    _scheduleSentinelBoot();

    // Exponer API mínima para diagnóstico en DevTools
    // Nota: para subir avatares desde el frontend debe existir el bucket público `avatars`
    // con políticas RLS apropiadas configuradas manualmente en Supabase.
    window.Sentinel = {
        syncNow:    () => _sentinelSync(),
        getSession: () => _sbSession,
        getClient:  () => _sbClient,
        getStatus:  () => ({ hasClient: !!_sbClient, hasSession: !!_sbSession }),
        _rehydrateHubStoreFromDisk: () => _rehydrateHubStoreFromDisk(),
    };

})(); // fin IIFE SentinelCloudSync
