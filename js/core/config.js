// Este script clásico debe cargarse antes de js/app.js; no depende de store ni del DOM.
(function initLoveArcadeConfig() {
    // =====================================================
    // CONFIGURACIÓN GLOBAL
    // =====================================================
    const CONFIG = {
        stateKey:      'gamecenter_v6_promos', // ← NO modificar jamás
        initialCoins:  0,
        dailyReward:   20,     // Monedas base del día 1 (se escala con racha)
        dailyStreakCap: 60,    // Máximo de monedas por bono diario
        dailyStreakStep: 5,    // Incremento por día de racha
        wallpapersPath: 'https://res.cloudinary.com/dyspgn0sw/image/upload/'
    };
    // =====================================================
    // ECONOMÍA — Editar aquí para eventos especiales
    // =====================================================
    const ECONOMY = {
        isSaleActive:   false,
        saleMultiplier: 0.80,
        saleLabel:      '-20%',
        cashbackRate:   0.1
    };
    // =====================================================
    // TEMAS
    // =====================================================
    const THEMES = {
        red:        { accent: '#FF3B30', name: 'Rojo' },
        brick:      { accent: '#C0392B', name: 'Ladrillo' },
        rose:       { accent: '#FF375F', name: 'Rosa Intenso' },
        magenta:    { accent: '#FF2D92', name: 'Magenta' },
        orange:     { accent: '#FF9500', name: 'Naranja' },
        amber_deep: { accent: '#E67E22', name: 'Ámbar Profundo' },
        yellow:     { accent: '#FFCC00', name: 'Amarillo' },
        gold_soft:  { accent: '#F4D03F', name: 'Dorado Suave' },
        lime:       { accent: '#A8E063', name: 'Lima' },
        green:      { accent: '#30D158', name: 'Verde' },
        emerald:    { accent: '#2ECC71', name: 'Esmeralda' },
        teal:       { accent: '#1ABC9C', name: 'Verde Azulado' },
        ocean:      { accent: '#006689', name: 'Océano' },
        cyan:       { accent: '#26C6DA', name: 'Cian' },
        sky:        { accent: '#5AC8FA', name: 'Cielo' },
        blue:       { accent: '#0A84FF', name: 'Azul' },
        azure:      { accent: '#2196F3', name: 'Azur' },
        indigo:     { accent: '#5856D6', name: 'Índigo' },
        violet:     { accent: '#7C3AED', name: 'Violeta' },
        purple:     { accent: '#9B59B6', name: 'Púrpura' },
        sienna:     { accent: '#A0522D', name: 'Siena' },
        bronze:     { accent: '#8B6914', name: 'Bronce' },
        graphite:   { accent: '#636366', name: 'Grafito' },
        slate:      { accent: '#48484A', name: 'Pizarra' },
        white:      { accent: '#FFFFFF', name: 'Blanco' }
    };

    // Convierte selecciones retiradas a la alternativa cromática más cercana.
    // `cyan` y `violet` se conservan como claves para no invalidar selecciones existentes.
    const LEGACY_THEME_FALLBACK = {
        pink: 'magenta',
        gold: 'yellow',
        crimson: 'red'
    };

    // Conserva los contratos públicos consumidos por scripts clásicos.
    window.CONFIG = CONFIG;
    window.ECONOMY = ECONOMY;
    window.THEMES = THEMES;

    // Datos internos consumidos por el store antes de cargar los módulos de dominio.
    window.LoveArcadeConfig = { LEGACY_THEME_FALLBACK };
})();
