/**
 * PVZ_Game.js
 * Escena principal del juego. Implementa la rejilla de 9x5 y la lógica de combate.
 */

class PVZ_Game extends Phaser.Scene {
    constructor() {
        super('PVZ_Game');
    }

    create() {
        console.log('[PVZ] Game scene started');

        // Grupos para colisiones y gestión
        this.pvz_plants = this.add.group({ runChildUpdate: true });
        this.pvz_zombies = this.add.group({ runChildUpdate: true });
        this.pvz_projectiles = this.add.group({ runChildUpdate: true });

        // Fondo base
        this.add.rectangle(0, 0, PVZ_Config.WIDTH, PVZ_Config.HEIGHT, 0x111111).setOrigin(0);

        // Dibujar el patio (Rejilla de 9x5)
        this.pvz_drawGrid();

        // Título o HUD simple
        this.add.text(20, 20, 'PLANTS VS ZOMBIES - ARCADE', {
            font: 'bold 24px Rajdhani',
            fill: '#2d5a27'
        });

        // Configurar Colisiones
        this.pvz_setupCollisions();

        // Spawn inicial de prueba
        this.time.addEvent({
            delay: 3000,
            callback: this.pvz_spawnRandomZombie,
            callbackScope: this,
            loop: true
        });

        // Planta de prueba
        this.pvz_addPlant(1, 2);
    }

    update(time, delta) {
        // Ejecutar los bucles de actualización de todos los grupos
        // runChildUpdate: true ya está configurado en el grupo, pero
        // Phaser 3 requiere que el grupo en sí reciba una señal de actualización
        // si no se está usando el sistema de escenas automáticas de Phaser para grupos.
        this.pvz_plants.getChildren().forEach(p => p.update(time, delta));
        this.pvz_zombies.getChildren().forEach(z => z.update(time, delta));
        this.pvz_projectiles.getChildren().forEach(proj => proj.update(time, delta));
    }

    /**
     * Configura los sistemas de colisión de Phaser
     */
    pvz_setupCollisions() {
        // Colisión Proyectil -> Zombie
        this.physics.add.overlap(this.pvz_projectiles, this.pvz_zombies, (projectile, zombie) => {
            if (projectile.active && !zombie.pvz_isDead) {
                zombie.takeDamage(projectile.pvz_damage);
                projectile.deactivate();

                // Efecto de impacto
                this.cameras.main.shake(100, 0.001);
            }
        });

        // Colisión Zombie -> Planta
        this.physics.add.overlap(this.pvz_zombies, this.pvz_plants, (zombie, plant) => {
            if (!zombie.pvz_isEating && !plant.pvz_isDead) {
                zombie.pvz_isEating = true;
                zombie.pvz_targetPlant = plant;
            }
        });
    }

    /**
     * Dibuja la rejilla de juego
     */
    pvz_drawGrid() {
        const { COLUMNS, ROWS, CELL_WIDTH, CELL_HEIGHT, OFFSET_X, OFFSET_Y } = PVZ_Config.GRID;
        const { STRIPE_1, STRIPE_2 } = PVZ_Config.COLORS;

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLUMNS; c++) {
                const x = OFFSET_X + (c * CELL_WIDTH);
                const y = OFFSET_Y + (r * CELL_HEIGHT);
                const color = (r + c) % 2 === 0 ? STRIPE_1 : STRIPE_2;

                const cell = this.add.rectangle(x, y, CELL_WIDTH, CELL_HEIGHT, color)
                    .setOrigin(0)
                    .setStrokeStyle(1, 0xffffff, 0.1);

                cell.setInteractive();
                cell.on('pointerdown', () => this.pvz_onCellClick(c, r));
            }
        }
    }

    pvz_onCellClick(col, row) {
        console.log(`[PVZ] Click en Celda: Col ${col}, Fila ${row}`);
        // Futuro: Sistema de plantación
        if (!this.pvz_hasPlantInCell(col, row)) {
            this.pvz_addPlant(col, row);
        }
    }

    /**
     * Añade una planta en una posición específica de la rejilla
     */
    pvz_addPlant(col, row) {
        const { CELL_WIDTH, CELL_HEIGHT, OFFSET_X, OFFSET_Y } = PVZ_Config.GRID;
        const x = OFFSET_X + (col * CELL_WIDTH) + CELL_WIDTH / 2;
        const y = OFFSET_Y + (row * CELL_HEIGHT) + CELL_HEIGHT;

        const plant = new PVZ_Plant(this, x, y, row);
        this.pvz_plants.add(plant);
        this.physics.add.existing(plant);
        plant.body.setImmovable(true);
    }

    pvz_hasPlantInCell(col, row) {
        // Verificación simple por posición (se puede mejorar con una matriz)
        return this.pvz_plants.getChildren().some(p => {
            const gridX = Math.floor((p.x - PVZ_Config.GRID.OFFSET_X) / PVZ_Config.GRID.CELL_WIDTH);
            const gridY = Math.floor((p.y - PVZ_Config.GRID.OFFSET_Y - 1) / PVZ_Config.GRID.CELL_HEIGHT);
            return gridX === col && gridY === row;
        });
    }

    /**
     * Spawnea un zombie en una fila aleatoria
     */
    pvz_spawnRandomZombie() {
        const row = Phaser.Math.Between(0, PVZ_Config.GRID.ROWS - 1);
        const { CELL_HEIGHT, OFFSET_Y } = PVZ_Config.GRID;
        const x = PVZ_Config.WIDTH + 50;
        const y = OFFSET_Y + (row * CELL_HEIGHT) + CELL_HEIGHT;

        const zombie = new PVZ_Zombie(this, x, y, row);
        this.pvz_zombies.add(zombie);
        this.physics.add.existing(zombie);
    }

    /**
     * Gestiona el pooling de proyectiles
     */
    pvz_spawnProjectile(x, y) {
        let projectile = this.pvz_projectiles.getFirstDead(false);

        if (!projectile) {
            projectile = new PVZ_Projectile(this, x, y);
            this.pvz_projectiles.add(projectile);
            this.physics.add.existing(projectile);
        } else {
            projectile.fire(x, y);
        }
    }

    /**
     * Comprueba si hay enemigos en una fila específica
     */
    pvz_hasEnemiesInRow(row) {
        return this.pvz_zombies.getChildren().some(z => z.pvz_row === row && z.active && z.x < PVZ_Config.WIDTH);
    }

    /**
     * Reporta la muerte de un zombie a Love Arcade
     */
    pvz_reportZombieDeath() {
        const reward = PVZ_Config.REWARDS.COINS_PER_ZOMBIE;

        // Reportar usando completeLevel según el estándar solicitado
        if (window.GameCenter && window.GameCenter.completeLevel) {
            // Usamos un ID de nivel dinámico o genérico para el reporte de combate
            const zombieId = `zombie-defeat-${Date.now()}`;
            window.GameCenter.completeLevel('pvz-arcade', zombieId, reward);
        } else {
            console.log('[PVZ] Standalone: +5 monedas (simulado)');
        }
    }
}

window.PVZ_Game = PVZ_Game;
