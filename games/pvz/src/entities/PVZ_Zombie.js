/**
 * PVZ_Zombie.js
 * Clase para los zombies.
 */

class PVZ_Zombie extends PVZ_Entity {
    constructor(scene, x, y, row) {
        super(scene, x, y, PVZ_Config.ASSETS.ZOMBIE_BASIC.key);

        this.pvz_row = row;
        this.pvz_hp = PVZ_Config.COMBAT.ZOMBIE_HP;
        this.pvz_speed = PVZ_Config.COMBAT.ZOMBIE_SPEED;
        this.pvz_damage = PVZ_Config.COMBAT.ZOMBIE_DAMAGE;
        this.pvz_attackRate = PVZ_Config.COMBAT.ZOMBIE_ATTACK_RATE;
        this.pvz_lastAttackTime = 0;

        this.pvz_isEating = false;
        this.pvz_targetPlant = null;

        this.setOrigin(0.5, 1);
    }

    update(time, delta) {
        if (this.pvz_isDead) return;

        if (this.pvz_isEating) {
            this.pvz_eat(time);
        } else {
            this.pvz_move(delta);
        }
    }

    /**
     * Lógica de movimiento
     */
    pvz_move(delta) {
        // Normalizar movimiento con delta (basado en 60 FPS -> 16.66ms)
        this.x += (this.pvz_speed * delta) / 16.66;

        // Si llega al final del patio (Game Over)
        if (this.x < PVZ_Config.GRID.OFFSET_X - 20) {
            this.scene.pvz_triggerGameOver();
        }
    }

    /**
     * Lógica de ataque a plantas
     */
    pvz_eat(time) {
        if (!this.pvz_targetPlant || this.pvz_targetPlant.pvz_isDead) {
            this.pvz_isEating = false;
            this.pvz_targetPlant = null;
            return;
        }

        if (time > this.pvz_lastAttackTime + this.pvz_attackRate) {
            this.pvz_lastAttackTime = time;
            this.pvz_targetPlant.takeDamage(this.pvz_damage);

            // Animación de mordida
            this.scene.tweens.add({
                targets: this,
                x: this.x - 5,
                duration: 50,
                yoyo: true
            });
        }
    }

    /**
     * Sobrescribir morir para reportar monedas
     */
    die() {
        if (this.pvz_isDead) return;

        // Reportar monedas antes de ser destruido
        if (this.scene.pvz_reportZombieDeath) {
            this.scene.pvz_reportZombieDeath();
        }

        super.die();
    }
}

window.PVZ_Zombie = PVZ_Zombie;
