/**
 * WORD HUNT - Configuración de Niveles
 * LoveArcade Integration
 * 
 * Cada nivel incluye:
 * - id: Identificador único
 * - title: Nombre descriptivo
 * - gridSize: Tamaño de la cuadrícula (mínimo 10x10)
 * - words: Array de palabras a encontrar
 * - rewardCoins: Monedas otorgadas al completar
 *
 * --- CRITERIOS DE RECOMPENSA APLICADOS ---
 * Básica  (Easy):   10x10, 5-6 palabras      → 100-125
 * Media   (Medium): 11x11, 6-8 palabras      → 130-175
 * Avanzada (Hard):  12x12, 8-10 palabras     → 180-225
 * Maestra / Hito:   12x12+, 10+ palabras     → 230-250
 * Bonus +20: nivel contiene palabras de más de 8 caracteres
 * Técnica: Programación / Ciencia / Filosofía → 200-250
 * Hito cada 10 niveles                        → 250
 *
 * Este lote reemplaza la tanda anterior (lvl_01 a lvl_200).
 * Contiene únicamente los 20 niveles nuevos, del lvl_201 al lvl_220,
 * organizados en 4 bloques temáticos de dificultad ascendente.
 */

window.LA_WS_LEVELS = [

    // ─── BLOQUE 201-205: Confort, Nostalgia y Calentamiento ───

    {
        id: "lvl_201",
        title: "Ritual del Café",
        gridSize: 10,
        words: ["CAPUCHINO", "INFUSION", "MATCHA", "MOLINILLO", "CANELA", "BARISTA"],
        rewardCoins: 145 // Básica: 10x10, 6 palabras (125) + Bonus CAPUCHINO/MOLINILLO (9) → 145
    },
    {
        id: "lvl_202",
        title: "Fiebre Retro",
        gridSize: 10,
        words: ["TAMAGOTCHI", "VIDEOCLUB", "CASSETTE", "MESSENGER", "DISCMAN"],
        rewardCoins: 120 // Básica: 10x10, 5 palabras (100) + Bonus TAMAGOTCHI/VIDEOCLUB/MESSENGER (9+) → 120
    },
    {
        id: "lvl_203",
        title: "Sazón de Abuela",
        gridSize: 10,
        words: ["GUISADO", "ESTOFADO", "ROMERO", "HORNO", "RECETARIO", "CALDITO"],
        rewardCoins: 145 // Básica: 10x10, 6 palabras (125) + Bonus RECETARIO (9) → 145
    },
    {
        id: "lvl_204",
        title: "Luces de Cine",
        gridSize: 11,
        words: ["CLAQUETA", "NEON", "DIRECTOR", "SECUELA", "PROYECTOR", "ENCUADRE"],
        rewardCoins: 150 // Media: 11x11, 6 palabras (130) + Bonus PROYECTOR (9) → 150
    },
    {
        id: "lvl_205",
        title: "Cosmos Infinito",
        gridSize: 11,
        words: ["NEBULOSA", "ORION", "SUPERNOVA", "ECLIPSE", "ASTROLABIO", "COSMOS", "GALAXIA"],
        rewardCoins: 170 // Media: 11x11, 7 palabras (150) + Bonus SUPERNOVA/ASTROLABIO (9+) → 170
    },

    // ─── BLOQUE 206-210: Placeres, Naturaleza y Cultura ───

    {
        id: "lvl_206",
        title: "Selva Interior",
        gridSize: 10,
        words: ["MONSTERA", "FICUS", "ESPORA", "SUCULENTA", "FLORACION", "TERRARIO"],
        rewardCoins: 145 // Básica: 10x10, 6 palabras (125) + Bonus SUCULENTA/FLORACION (9) → 145
    },
    {
        id: "lvl_207",
        title: "Sabores Callejeros",
        gridSize: 11,
        words: ["TACOS", "RAMEN", "CREPE", "BAO", "FALAFEL", "GELATO", "AREPA"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_208",
        title: "Bestiario Perdido",
        gridSize: 12,
        words: ["FENIX", "GRIFO", "QUIMERA", "BASILISCO", "VALKIRIA", "DRAGON", "CENTAURO", "CICLOPE"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras (180) + Bonus BASILISCO (9) → 200
    },
    {
        id: "lvl_209",
        title: "Vinilo & Ritmo",
        gridSize: 12,
        words: ["SINTETIZADOR", "UKULELE", "ACORDE", "VINILO", "BOSSA", "BATERIA", "MELODIA", "COMPAS"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras (180) + Bonus SINTETIZADOR (12) → 200
    },
    {
        id: "lvl_210",
        title: "Sonidos de la Noche",
        gridSize: 12,
        words: ["PENUMBRA", "LECHUZA", "GRILLO", "LUCIERNAGA", "SUSURRO", "BRISA", "NOCTURNO", "MURCIELAGO", "SILENCIO", "ECO"],
        rewardCoins: 250 // HITO nivel 210 + Maestra: 12x12, 10 palabras + LUCIERNAGA/MURCIELAGO (10) → máxima recompensa
    },

    // ─── BLOQUE 211-215: Mente, Letras y Misterio ───

    {
        id: "lvl_211",
        title: "Palabras que Duelen",
        gridSize: 12,
        words: ["SAUDADE", "SERENDIPIA", "PETRICOR", "INEFABLE", "EFIMERO", "RESILIENCIA", "NOSTALGIA", "MELANCOLIA"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras (180) + Bonus SERENDIPIA/RESILIENCIA/NOSTALGIA/MELANCOLIA (9+) → 200
    },
    {
        id: "lvl_212",
        title: "Pista Oculta",
        gridSize: 11,
        words: ["COARTADA", "DETECTIVE", "LUPA", "SOSPECHOSO", "ENIGMA", "MOVIL", "INDICIO"],
        rewardCoins: 170 // Media: 11x11, 7 palabras (150) + Bonus DETECTIVE/SOSPECHOSO (9+) → 170
    },
    {
        id: "lvl_213",
        title: "Ficha Insertada",
        gridSize: 11,
        words: ["JOYSTICK", "RECORD", "COMBO", "PANTALLA", "NIVEL", "CONSOLA", "ARCADE"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_214",
        title: "Entre Anaqueles",
        gridSize: 12,
        words: ["EXLIBRIS", "MANUSCRITO", "CAPITULERA", "TINTA", "PROLOGO", "ANAQUEL", "ENCUADERNAR", "PERGAMINO"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras (180) + Bonus MANUSCRITO/CAPITULERA/ENCUADERNAR/PERGAMINO (9+) → 200
    },
    {
        id: "lvl_215",
        title: "Grimorio Arcano",
        gridSize: 12,
        words: ["GRIMORIO", "ELIXIR", "RUNA", "CAVERNA", "HECHIZO", "ALQUIMIA", "MAZMORRA", "CONJURO"],
        rewardCoins: 180 // Avanzada: 12x12, 8 palabras
    },

    // ─── BLOQUE 216-220: Desafíos Finales ───

    {
        id: "lvl_216",
        title: "Espejismo Visual",
        gridSize: 12,
        words: ["PRISMA", "CALEIDOSCOPIO", "REFLEJO", "ESPEJISMO", "MATIZ", "VERTIGO", "ILUSION", "DISTORSION"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras (180) + Bonus CALEIDOSCOPIO/ESPEJISMO/DISTORSION (9+) → 200
    },
    {
        id: "lvl_217",
        title: "Paradoja Temporal",
        gridSize: 12,
        words: ["PARADOJA", "VORTEX", "HOLOGRAMA", "ANDROIDE", "PORTAL", "CUANTICO", "FUTURO", "TELETRANSPORTE"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras (180) + Bonus HOLOGRAMA/TELETRANSPORTE (9+) → 200
    },
    {
        id: "lvl_218",
        title: "Universo de Cacao",
        gridSize: 11,
        words: ["CACAO", "TRUFA", "GANACHE", "HOJALDRE", "PRALINE", "PERA", "TABLETA"],
        rewardCoins: 150 // Media: 11x11, 7 palabras
    },
    {
        id: "lvl_219",
        title: "Tesoro del Abismo",
        gridSize: 12,
        words: ["BRUJULA", "GALEON", "TIMON", "ARRECIFE", "CATALEJO", "BOTIN", "NAUFRAGIO", "BUCANERO"],
        rewardCoins: 200 // Avanzada: 12x12, 8 palabras (180) + Bonus NAUFRAGIO (9) → 200
    },
    {
        id: "lvl_220",
        title: "El Arte de la Sopa",
        gridSize: 12,
        words: ["CUADRICULA", "DIAGONAL", "ESCONDIDA", "HALLAZGO", "TRAZADO", "SOLUCION", "PALABRA", "BUSQUEDA", "REJILLA", "DESCUBRIMIENTO"],
        rewardCoins: 250 // HITO nivel 220 + GRAN FINAL + Maestra: 12x12, 10 palabras + CUADRICULA/ESCONDIDA/DESCUBRIMIENTO (9+) → máxima recompensa
    }
];

// Validación de niveles al cargar
(function validateLevels() {
    const seenIds = new Set();
    
    window.LA_WS_LEVELS.forEach((level, index) => {
        // Validar ID único
        if (seenIds.has(level.id)) {
            console.error(`[WordSearch] Error: ID duplicado "${level.id}" en nivel ${index + 1}`);
        }
        seenIds.add(level.id);

        // Validar gridSize mínimo
        if (level.gridSize < 10) {
            console.error(`[WordSearch] Error: gridSize debe ser >= 10 en nivel "${level.id}"`);
        }

        // Validar rewardCoins
        if (!Number.isInteger(level.rewardCoins) || level.rewardCoins <= 0) {
            console.error(`[WordSearch] Error: rewardCoins debe ser entero positivo en nivel "${level.id}"`);
        }

        // Validar palabras
        if (!Array.isArray(level.words) || level.words.length === 0) {
            console.error(`[WordSearch] Error: words debe ser array no vacío en nivel "${level.id}"`);
        }
    });

    console.log(`[WordSearch] ✓ ${window.LA_WS_LEVELS.length} niveles cargados correctamente`);
})();
