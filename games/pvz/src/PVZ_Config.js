/**
 * PVZ_Config.js
 * Configuración global y namespace para el minijuego Plants vs. Zombies.
 */

const PVZ_Config = {
    // Dimensiones de referencia (diseño base)
    WIDTH: 800,
    HEIGHT: 600,

    // Configuración de la Rejilla (Grid)
    GRID: {
        COLUMNS: 9,
        ROWS: 5,
        CELL_WIDTH: 80,
        CELL_HEIGHT: 100,
        OFFSET_X: 80, // Margen izquierdo para el patio
        OFFSET_Y: 100 // Margen superior
    },

    // Colores base
    COLORS: {
        STRIPE_1: 0x5a9e45,
        STRIPE_2: 0x4d8a3b,
        GRID_BORDER: 0xffffff
    },

    // Economía y Combate
    COMBAT: {
        PLANT_HP: 100,
        ZOMBIE_HP: 100,
        ZOMBIE_SPEED: -0.5, // Píxeles por frame (aprox)
        ZOMBIE_DAMAGE: 10,
        ZOMBIE_ATTACK_RATE: 1000, // ms entre mordiscos

        PROJECTILE_SPEED: 300, // Píxeles por segundo
        PROJECTILE_DAMAGE: 20,

        PLANT_ATTACK_RATE: 1500 // ms entre disparos
    },

    REWARDS: {
        COINS_PER_ZOMBIE: 5,
        COINS_PER_LEVEL: 50
    }
};

// Asegurar que PVZ_Config sea accesible globalmente si es necesario,
// respetando el prefijo PVZ_
window.PVZ_Config = PVZ_Config;
