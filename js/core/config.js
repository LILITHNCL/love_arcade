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

    // =====================================================
    // CÓDIGOS PROMOCIONALES — SHA-256 (no texto plano)
    // Generados con: echo -n "CODIGO" | sha256sum
    // Para agregar nuevos códigos ver DOCUMENTACION.md §12
    // =====================================================
    const PROMO_CODES_HASHED = {
    '4564f1daae1dd157925088fce37fefc9869dabbbd7f860069dcf593d4d620a4b': 2500,   // PVZGW2500
    '5136694194f15aecc6eae3645b56b6a8273876d6d830709cf7591dd89a05b066': 500,    // PVZGW500
    'fe499ddb40f6bf77d1b7b18efe6c365848b46a9522e8c37155bcf306fad2e0ee': 1000,   // BOCCHICAT1000
    'aec9091f68e1f1324e1ed9b8ccb6ce86a137a9b2c3440ea5d2fa83bb2fb70523': 1000,   // 09112024
    'a6670a5454af70c97e1fc2fc457af9521383055a257ba58ac549c5ccc7766a85': 200,    // VERSION9
    '02d936b1e7ecebb010709ccc9b82509f092b98a89731dcf474829451dd627ee9': 13000,  // PAGO_QA
    'fc4cbe30d1379fac9ba1cf923cc7e076f3d90a69a321fce8d683e1380077a7d8': 1200,   // FIX_REWARD_120426
    '5c9808d0e5afe7cd0e5e19c64f438ebed38258f78d96f1a378a23726ba6ecbfc': 1000,   // SOLECITO
    'ec029eed55db3414455e78c607816941e092595f65d3cdb9dbe63a81cdcd1b2c': 1000,   // LUNITA
    'f28aab1b9b359e780d112664e9ff6dfd8cff51087b5f192d62635cc7f5b5342c': 6000,   // HACO260526
    '2bf4c2eb61f4e85707f9e605286940f92a89d689dd9a17b777bfd674ecb46caf': 2000,   // HLSEPENM
    '85b7e539867d4e35ff3ce361ffa570fb48e09eb49abdfe1b83887a96c8384260': 2800,   // MIKU9X0L
    '6e64009694ee0e0393b0f1f4cfc53243b8ebc124bee98cea44ceb3eeabf8693a': 1500,   // YORHA2B
    '90054feb0a9c729328ff46d4db30f3ea6c7d21345640baacf5e9a1467b216b0d': 2600,   // LOVEARCADE140
    'fadb13b212d99b0004d638aab80538248b9aec7574aa3405a719adcc0a7385fa': 3000,   // RACHA150
    '4e5940a77ef06b18f962a197d7575651c4c7eeefbacd9ca2b2368d346e3f4916': 3900,   // TEAMO505
    '582969a27a84f2b65970db6cb1907706e6518405ced1876352f6627d794b430e': 500,	// SOFIA
    'b4177b30a6360acd2218580059f57112eaf3d35235891587bf7b59c41898c445': 500,	// IRINA
    '886c69ca4881e8d3ae8eec6195a1938d60ec7571afc68e319cc83cc674f28a92': 500,	// PAMELA
    'a47c599679256867ef7830d708863532e26b39b95846119444126bd13aec00d6': 500,	// VALERIA
    '5517bab653668facef67e08f959d3af9f63e80a0570411d1f4f7c6b0460bc24e': 500,	// EVA
    '0764b5fde5722f06d5599cf473df5797f15789a5443d709c1fd4a527c678c1eb': 500,	// ESTRELLA
    '769ebd29743c25c40dafe90e67c66fde9c4eb024de71ef31be72a6ffa1554307': 500,	// ESTEFANIA
    '6206c228c84dd0e2b3392bb9d2eae9fef5cba0d0b9c272103aa35bdc02fbcb5b': 500,	// NATALIA
    '94d3ba4b903449974462271b33fdba878c0e3969d6f18fac49ca4146ae62f7c6': 500,	// MONTSERRAT
    '399c362cc8a1ccde7884efa95a2bffbddcb5eb23b32013a804af3a7e6a65ed4a': 500 	// JULIETA
    };


    // Conserva los contratos públicos consumidos por scripts clásicos.
    window.CONFIG = CONFIG;
    window.ECONOMY = ECONOMY;
    window.THEMES = THEMES;

    // Datos internos mientras la lógica de estado y promociones siga en app.js.
    window.LoveArcadeConfig = { LEGACY_THEME_FALLBACK, PROMO_CODES_HASHED };
})();
