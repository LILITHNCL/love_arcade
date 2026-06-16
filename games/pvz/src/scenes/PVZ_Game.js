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

        // Cargar progreso
        this.pvz_playerData = PVZ_Storage.pvz_getData();

        // Configuración de dificultad dinámica
        const difficulty = PVZ_Config.getBalancing(this.pvz_playerData.levelsCompleted + 1);

        // Estado del juego
        this.pvz_suns = PVZ_Config.ECONOMY.INITIAL_SUNS;
        this.pvz_selectedPlant = null;
        this.pvz_isGameOver = false;
        this.pvz_zombiesDefeated = 0;
        this.pvz_zombiesToDefeat = 5 + (this.pvz_playerData.levelsCompleted * 2);
        this.pvz_canPlant = true; // Control de anti-ghost click
        this.pvz_difficulty = difficulty;

        // Grupos para colisiones y gestión
        this.pvz_plants = this.add.group({ runChildUpdate: true });
        this.pvz_zombies = this.add.group({ runChildUpdate: true });
        this.pvz_projectiles = this.add.group({ runChildUpdate: true });

        // Fondo base
        this.add.rectangle(0, 0, PVZ_Config.WIDTH, PVZ_Config.HEIGHT, 0x111111).setOrigin(0);

        // Dibujar el patio (Rejilla de 9x5)
        this.pvz_drawGrid();

        // Configurar Colisiones
        this.pvz_setupCollisions();

        // Generación automática de soles
        this.time.addEvent({
            delay: difficulty.SUN_GEN_RATE,
            callback: () => { this.pvz_suns += PVZ_Config.ECONOMY.SUN_VALUE; },
            loop: true
        });

        // Spawn de zombies
        this.pvz_spawnTimer = this.time.addEvent({
            delay: difficulty.SPAWN_RATE,
            callback: this.pvz_spawnRandomZombie,
            callbackScope: this,
            loop: true
        });

        // Lanzar UI
        this.scene.launch('PVZ_UI');
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
        if (!this.pvz_selectedPlant || !this.pvz_canPlant) return;

        const cost = PVZ_Config.ECONOMY.PLANT_COSTS[this.pvz_selectedPlant];

        if (this.pvz_suns >= cost && !this.pvz_hasPlantInCell(col, row)) {
            // Bloquear plantación momentáneamente para evitar ghost clicks en móviles
            this.pvz_canPlant = false;
            this.time.delayedCall(200, () => { this.pvz_canPlant = true; });

            this.pvz_suns -= cost;
            this.pvz_addPlant(col, row);
            this.pvz_selectedPlant = null;
            console.log(`[PVZ] Planta colocada en ${col},${row}. Soles restantes: ${this.pvz_suns}`);
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
        zombie.pvz_speed = this.pvz_difficulty.ZOMBIE_SPEED; // Aplicar dificultad
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

        // Incrementar contador de progreso
        this.pvz_zombiesDefeated++;
        if (this.pvz_zombiesDefeated >= this.pvz_zombiesToDefeat) {
            this.pvz_triggerVictory();
        }

        // Reportar usando completeLevel según el estándar solicitado
        if (window.GameCenter && window.GameCenter.completeLevel) {
            const zombieId = `zombie-defeat-${Date.now()}`;
            window.GameCenter.completeLevel('pvz-arcade', zombieId, reward);
        } else {
            console.log('[PVZ] Standalone: +5 monedas (simulado)');
        }
    }

    pvz_triggerGameOver() {
        if (this.pvz_isGameOver) return;
        this.pvz_isGameOver = true;

        this.scene.pause();
        this.scene.launch('PVZ_GameOver');
    }

    pvz_triggerVictory() {
        if (this.pvz_isGameOver) return;
        this.pvz_isGameOver = true;

        // Actualizar persistencia local
        const data = PVZ_Storage.pvz_getData();
        data.levelsCompleted++;
        PVZ_Storage.pvz_saveData(data);

        // Reportar recompensa final de nivel
        const finalReward = PVZ_Config.REWARDS.COINS_PER_LEVEL;
        const sessionId = `pvz-win-${Date.now()}`;

        if (window.GameCenter && window.GameCenter.completeLevel) {
            window.GameCenter.completeLevel('pvz-arcade', sessionId, finalReward);
        }

        this.scene.pause();
        this.scene.launch('PVZ_Victory', { reward: finalReward });
    }
}

window.PVZ_Game = PVZ_Game;
