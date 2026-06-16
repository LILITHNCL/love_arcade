/**
 * PVZ_Game.js
 * Escena principal del juego. Implementa la rejilla de 9x5.
 */

class PVZ_Game extends Phaser.Scene {
    constructor() {
        super('PVZ_Game');
    }

    create() {
        console.log('[PVZ] Game scene started');

        // Fondo base
        this.add.rectangle(0, 0, PVZ_Config.WIDTH, PVZ_Config.HEIGHT, 0x111111).setOrigin(0);

        // Dibujar el patio (Rejilla de 9x5)
        this.pvz_drawGrid();

        // Título o HUD simple
        this.add.text(20, 20, 'PLANTS VS ZOMBIES - ARCADE', {
            font: 'bold 24px Rajdhani',
            fill: '#2d5a27'
        });
    }

    /**
     * Dibuja la rejilla de juego basándose en la configuración de PVZ_Config
     */
    pvz_drawGrid() {
        const { COLUMNS, ROWS, CELL_WIDTH, CELL_HEIGHT, OFFSET_X, OFFSET_Y } = PVZ_Config.GRID;
        const { STRIPE_1, STRIPE_2 } = PVZ_Config.COLORS;

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLUMNS; c++) {
                const x = OFFSET_X + (c * CELL_WIDTH);
                const y = OFFSET_Y + (r * CELL_HEIGHT);

                // Color alternado (rayas de césped)
                const color = (r + c) % 2 === 0 ? STRIPE_1 : STRIPE_2;

                const cell = this.add.rectangle(x, y, CELL_WIDTH, CELL_HEIGHT, color)
                    .setOrigin(0)
                    .setStrokeStyle(1, 0xffffff, 0.1); // Borde sutil

                // Hacer la celda interactiva para plantar (futuro)
                cell.setInteractive();
                cell.on('pointerdown', () => {
                    console.log(`[PVZ] Click en Celda: Col ${c}, Fila ${r}`);
                });
            }
        }
    }

    /**
     * Reporta la finalización del nivel a Love Arcade
     */
    pvz_reportWin() {
        const reward = PVZ_Config.REWARDS.COINS_PER_LEVEL;

        if (window.GameCenter && window.GameCenter.completeLevel) {
            const result = window.GameCenter.completeLevel('pvz-arcade', 'level-1', reward);
            console.log('[PVZ] Monedas reportadas:', result);
        } else {
            console.warn('[PVZ] GameCenter no detectado. Recompensa simulada:', reward);
        }
    }
}

window.PVZ_Game = PVZ_Game;
