import { Storage } from '../systems/Storage.js';

// ─────────────────────────────────────────────────────────────
//  LevelManager v7.0 — Gestor de niveles, URLs Cloudinary
//                       y Prefetching Predictivo de ImageBitmap
//
//  CAMBIOS RESPECTO A v6.1
//  ───────────────────────
//  1. #prefetchedData (campo privado de clase)
//       Almacena { id: string, bitmap: ImageBitmap | null } del nivel
//       que se descargó y decodificó en background mientras el usuario
//       jugaba el nivel anterior.
//
//       Ciclo de vida del ImageBitmap almacenado:
//         a) Se crea en prefetchNextLevel() mediante fetch() + blob()
//            + createImageBitmap(). La decodificación ocurre en un
//            worker interno del navegador, fuera del Event Loop.
//         b) Se consume en getAndClearPrefetchedBitmap(): se transfiere
//            a startGame() y se limpia #prefetchedData (evita doble uso).
//         c) Si NO se usa (usuario navega al menú, cambia de nivel
//            manualmente, etc.) main.js llama a clearPrefetch() que
//            invoca bitmap.close() para liberar VRAM de forma determinista
//            antes de que actúe el GC.
//
//  2. prefetchNextLevel(currentId) — método async público
//       Ejecuta el pipeline de precarga del nivel N+1:
//         1. Resuelve el siguiente nivel con getNextLevelId().
//         2. Si ya hay un bitmap precargado para ese mismo ID,
//            sale inmediatamente (idempotente, sin red adicional).
//         3. Limpia cualquier bitmap previo que haya quedado sin
//            consumir (close() + reset de #prefetchedData).
//         4. Realiza fetch() con { priority: 'low' } para no competir
//            con el tráfico crítico del nivel activo.
//         5. Convierte la respuesta a Blob y llama a createImageBitmap()
//            para decodificar fuera del hilo principal.
//         6. Guarda el resultado en #prefetchedData.
//       Si createImageBitmap no está disponible o el fetch falla,
//       el error se captura silenciosamente: startGame() detectará
//       la ausencia del bitmap y seguirá su camino de carga normal
//       (fallback transparente).
//
//  3. getAndClearPrefetchedBitmap(id) — método público
//       Devuelve el bitmap precargado si su ID coincide con el
//       solicitado y lo limpia de #prefetchedData en el mismo acto.
//       Si no coincide (o no hay datos) devuelve null sin efecto
//       secundario. Esta operación es O(1) y no bloquea el Event Loop.
//
//  4. clearPrefetch() — método público
//       Libera el bitmap en #prefetchedData si existe, invocando
//       bitmap.close() para devolver la memoria de GPU al sistema de
//       forma determinista. Llamado desde main.js al destruir el juego
//       sin consumir la precarga (menú, cambio manual de nivel, error).
//
//  CAMBIOS RESPECTO A v6.0 (heredados de v6.1, sin modificación)
//  ──────────────────────────────────────────────────────────────
//  • buildImageUrl(): fl_lossless → q_100 (compatibilidad con todos
//    los planes de Cloudinary; evita HTTP 400).
//  • buildThumbnailUrl(): sin cambios. Thumbnails usan f_auto,q_auto.
//
//  CAMBIOS RESPECTO A v5.0 (heredados de v6.x, sin modificación)
//  ──────────────────────────────────────────────────────────────
//  • Eliminados _fullW / getFullImageWidth(). Resolución nativa 1600×1600.
//  • Parámetros de imagen: f_avif,q_100 (sin escalado en servidor).
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  Constantes de configuración
// ─────────────────────────────────────────────────────────────
const TOTAL_LEVELS    = 154;
const CLOUDINARY_BASE = 'https://res.cloudinary.com/dyspgn0sw/image/upload';

// ─────────────────────────────────────────────────────────────
//  Capacidad del dispositivo — sólo para thumbnails (v6.0)
//
//  _dpr y _maxDim se conservan únicamente para la lógica de
//  thumbnail. No se usan para la imagen de juego (siempre 1600px).
// ─────────────────────────────────────────────────────────────
const _dpr    = Math.min(window.devicePixelRatio || 1, 3);
const _maxDim = Math.max(
    (window.screen.width  || 375) * _dpr,
    (window.screen.height || 667) * _dpr
);

/**
 * Calcula el ancho de thumbnail para la cuadrícula de niveles.
 *
 * La tarjeta CSS tiene un mínimo de 100px. Se añade un 7% de margen
 * para evitar thumbnails borrosos en pantallas sub-píxel, y el resultado
 * se redondea al múltiplo de 80px más cercano para maximizar los aciertos
 * de caché en el CDN (distintos dispositivos con DPR similar comparten URL).
 *
 * DPR se limita a 2× para las miniaturas: la diferencia visual entre
 * 2× y 3× en una card de 100px es imperceptible pero el coste en bytes
 * triplica.
 *
 * @returns {number}
 */
function getThumbnailWidth() {
    const raw     = Math.ceil(100 * Math.min(_dpr, 2) * 1.07);
    const snapped = Math.ceil(raw / 80) * 80;
    return Math.max(160, Math.min(snapped, 320));
}

// Pre-calculado una sola vez para todos los thumbnails.
const _thumbW = getThumbnailWidth();

// ─────────────────────────────────────────────────────────────
//  Constructores de URL
// ─────────────────────────────────────────────────────────────

/**
 * URL de imagen completa — resolución nativa 1600×1600, AVIF calidad máxima.
 *
 * Parámetros Cloudinary:
 *   f_avif  : Fuerza formato AVIF para los assets originales en Cloudinary.
 *             adicional en el hilo de renderizado.
 *   q_100   : Calidad máxima del codificador AVIF (100/100).
 *             A este nivel de calidad, el codificador AVIF de Cloudinary
 *             activa automáticamente el modo sin pérdida (VP8L):
 *               - Sin submuestreo de croma (4:4:4 full).
 *               - Sin artefactos de compresión DCT.
 *               - Perfil ICC preservado íntegramente.
 *             Compatible con todos los planes de Cloudinary (evita el
 *             HTTP 400 que causaba fl_lossless en cuentas sin
 *             transformaciones activas habilitadas).
 *
 * Ausencia de w_:
 *   No se aplica reescalado en servidor. PuzzleEngine v19.1 reduce la
 *   textura en cliente mediante step-down scaling de alta fidelidad.
 *
 * @param {string} publicId  — ID del asset en Cloudinary (ej. "Nivel01").
 * @returns {string}         — URL completa del asset AVIF q_100 nativo 1600px.
 */
function buildImageUrl(publicId) {
    return `${CLOUDINARY_BASE}/f_avif,q_100/v1/${publicId}`;
}

/**
 * URL de thumbnail con ancho dinámico según DPR del dispositivo.
 *
 * Los thumbnails continúan usando f_auto,q_auto porque:
 *   • Su función es decorativa (cuadrícula de selección de nivel).
 *   • El tamaño pequeño (160–320px) hace imperceptibles los artefactos
 *     de compresión lossy.
 *   • El ahorro de ancho de banda al cargar 150 thumbnails es prioritario.
 *
 * @param {string} publicId
 * @returns {string}
 */
function buildThumbnailUrl(publicId) {
    return `${CLOUDINARY_BASE}/c_thumb,w_${_thumbW},g_center,f_auto,q_auto/v1/${publicId}`;
}

// ─────────────────────────────────────────────────────────────
//  Helpers de nivel
// ─────────────────────────────────────────────────────────────

function getPieces(n) {
    return n <= 10 ? 16 : 25;
}

function getRewardCoins(n) {
    return 150 + (n * 2);
}

// ─────────────────────────────────────────────────────────────
//  Clase principal
// ─────────────────────────────────────────────────────────────

export class LevelManager {
    /**
     * #prefetchedData — almacén privado del bitmap precargado.
     *
     * Estructura: { id: string, bitmap: ImageBitmap } | null
     *
     * Solo se almacena UN nivel a la vez (el N+1 del nivel activo).
     * El ciclo de vida completo es:
     *
     *   [null]
     *     │ prefetchNextLevel(currentId)
     *     ▼
     *   { id, bitmap }           ← bitmap decodificado en worker del navegador
     *     │
     *     ├─ getAndClearPrefetchedBitmap(id) coincide
     *     │    ▼
     *     │  devuelve bitmap → PuzzleEngine lo consume → bitmap.close() en destroy()
     *     │
     *     └─ clearPrefetch() / nueva precarga distinta
     *          ▼
     *        bitmap.close()  → VRAM liberada de forma determinista
     *        [null]
     */
    #prefetchedData = null;

    constructor() {
        this.levels = [];
    }

    /**
     * Genera los TOTAL_LEVELS objetos de configuración en memoria.
     * Declarado async para ser await-able en main.js y garantizar
     * que los datos de nivel existen antes de validar el progreso.
     */
    async loadLevels() {
        this.levels = Array.from({ length: TOTAL_LEVELS }, (_, i) => {
            const n = i + 1;
            // padStart(2,'0'): "Nivel01"…"Nivel09", "Nivel10"…"Nivel150"
            const publicId = `Nivel${String(n).padStart(2, '0')}`;

            return {
                id:          `lvl_v2_${n}`,
                index:       i,
                publicId,
                image:       buildImageUrl(publicId),
                thumbnail:   buildThumbnailUrl(publicId),
                pieces:      getPieces(n),
                rewardCoins: getRewardCoins(n),
                description: `Sector Neuronal ${n}`
            };
        });
    }

    // ───────────────────────────────────────────────────────────
    //  Prefetching Predictivo — API pública (v7.0)
    // ───────────────────────────────────────────────────────────

    /**
     * Descarga y decodifica en background la imagen del nivel N+1.
     *
     * Pipeline (todos los pasos fuera del hilo principal de la UI):
     *
     *   1. fetch(url, { priority: 'low' })
     *        El header `priority: low` indica al navegador y al servidor
     *        HTTP/2 que esta petición no debe competir con los recursos
     *        críticos del nivel activo (canvas, scripts). En HTTP/2 se
     *        asigna un stream weight bajo; en HTTP/1.1 el parámetro se
     *        ignora sin error.
     *
     *   2. response.blob()
     *        Obtiene los bytes de la imagen como Blob sin decodificar.
     *        El Blob vive en memoria fuera del heap de JS (memoria nativa
     *        del proceso del navegador), por lo que no presiona el GC de V8.
     *
     *   3. createImageBitmap(blob)
     *        Decodifica el WebP en un worker interno del navegador
     *        (ImageBitmapLoader thread en Chromium, o equivalente en
     *        Firefox/Safari). El Event Loop de la página no se bloquea
     *        en ningún momento del proceso: ni durante la descarga
     *        (fetch asíncrono) ni durante la decodificación
     *        (createImageBitmap es verdaderamente off-thread).
     *        El bitmap resultante vive en VRAM (textura GPU) listo para
     *        ser transferido a un canvas sin coste adicional de copia.
     *
     *   4. Almacena { id, bitmap } en #prefetchedData.
     *        A partir de este punto el bitmap permanece en VRAM hasta que:
     *          a) startGame() lo consume mediante getAndClearPrefetchedBitmap().
     *          b) clearPrefetch() lo descarta mediante bitmap.close().
     *
     * Idempotencia: si #prefetchedData ya contiene el bitmap del mismo
     * nivel, la función retorna inmediatamente sin generar tráfico de red.
     *
     * Seguridad ante fallos: cualquier error (CORS, 4xx/5xx, timeout,
     * createImageBitmap no disponible) se captura en el bloque catch.
     * #prefetchedData queda en null y startGame() ejecuta la carga normal.
     *
     * @param {string} currentId  — ID del nivel que el usuario está jugando.
     * @returns {Promise<void>}
     */
    async prefetchNextLevel(currentId) {
        const nextId = this.getNextLevelId(currentId);
        if (!nextId) return; // El usuario está en el último nivel.

        // Idempotente: el bitmap correcto ya está listo.
        if (this.#prefetchedData?.id === nextId) return;

        // Si hay un bitmap de otro nivel pendiente, liberarlo antes
        // de sobrescribir la referencia (evita fuga de VRAM).
        this.clearPrefetch();

        const nextLevel = this.getLevelById(nextId);
        if (!nextLevel) return;

        // createImageBitmap es necesario para el pipeline off-thread.
        // Si no está disponible, salimos aquí: startGame() usará su
        // propio camino de carga (HTMLImageElement + decode()).
        if (typeof createImageBitmap !== 'function') return;

        try {
            // priority: 'low' — no compite con el nivel activo.
            // El campo 'importance' (legacy) se incluye como fallback
            // para navegadores que implementaron la API antigua.
            const response = await fetch(nextLevel.image, {
                priority:   'low',
                importance: 'low'     // Fetch Priority API (legacy alias)
            });

            if (!response.ok) {
                console.warn(`[LevelManager] Prefetch HTTP ${response.status} para ${nextId}. Se ignorará.`);
                return;
            }

            // Blob: bytes del WebP sin decodificar, fuera del heap de JS.
            const blob = await response.blob();

            // Decodificación off-thread: no bloquea el Event Loop.
            const bitmap = await createImageBitmap(blob);

            this.#prefetchedData = { id: nextId, bitmap };
            console.log(`[LevelManager] ✅ Prefetch completado para ${nextId}.`);

        } catch (err) {
            // Fallo silencioso: startGame() carga el nivel normalmente.
            console.warn(`[LevelManager] Prefetch fallido para ${nextId}:`, err);
            this.#prefetchedData = null;
        }
    }

    /**
     * Devuelve el ImageBitmap precargado si coincide con el ID solicitado
     * y limpia #prefetchedData en el mismo acto (operación de un solo uso).
     *
     * El bitmap devuelto pasa a ser responsabilidad del consumidor
     * (main.js → PuzzleEngine). PuzzleEngine.destroy() llamará a
     * bitmap.close() cuando la partida termine o se abandone.
     *
     * Si el ID no coincide o no hay datos precargados, devuelve null
     * sin efecto secundario. startGame() interpretará null como señal
     * para iniciar su flujo de carga estándar.
     *
     * @param {string} id  — ID del nivel que se va a iniciar.
     * @returns {ImageBitmap|null}
     */
    getAndClearPrefetchedBitmap(id) {
        if (this.#prefetchedData?.id !== id) return null;

        const { bitmap } = this.#prefetchedData;
        this.#prefetchedData = null; // Limpia la referencia: evita doble uso y fuga.
        return bitmap;
    }

    /**
     * Descarta el bitmap precargado si existe, liberando su VRAM de forma
     * determinista antes de que actúe el GC.
     *
     * Debe llamarse desde main.js en cualquier transición que implique
     * que el bitmap precargado NO será consumido:
     *   • El usuario vuelve al menú desde la pantalla de juego.
     *   • El usuario selecciona manualmente un nivel diferente al N+1.
     *   • startGame() falla antes de llegar al punto de consumo.
     *
     * Llamar clearPrefetch() cuando #prefetchedData es null no produce
     * ningún efecto (idempotente).
     */
    clearPrefetch() {
        if (!this.#prefetchedData) return;
        const { id, bitmap } = this.#prefetchedData;
        if (bitmap && typeof bitmap.close === 'function') {
            bitmap.close();
            console.log(`[LevelManager] Bitmap de prefetch para ${id} liberado (close).`);
        }
        this.#prefetchedData = null;
    }

    // ───────────────────────────────────────────────────────────
    //  API de niveles — sin cambios respecto a v6.1
    // ───────────────────────────────────────────────────────────

    getAllLevelsWithStatus() {
        return this.levels.map(level => {
            const isUnlocked  = Storage.isUnlocked(level.id);
            const isCompleted = Storage.isCompleted(level.id);

            let status = 'locked';
            if (isUnlocked)  status = 'unlocked';
            if (isCompleted) status = 'completed';

            return {
                ...level,
                status,
                thumbnail: level.thumbnail || level.image
            };
        });
    }

    getLevelById(id) {
        return this.levels.find(l => l.id === id);
    }

    getNextLevelId(currentId) {
        const index = this.levels.findIndex(l => l.id === currentId);
        if (index !== -1 && index < this.levels.length - 1) {
            return this.levels[index + 1].id;
        }
        return null;
    }
}
