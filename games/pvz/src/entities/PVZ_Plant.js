/**
 * PVZ_Plant.js
 * Clase base para las plantas.
 */

class PVZ_Plant extends PVZ_Entity {
    constructor(scene, x, y, row) {
        super(scene, x, y, PVZ_Config.ASSETS.PLANT_BASIC.key);

        this.pvz_row = row;
        this.pvz_hp = PVZ_Config.COMBAT.PLANT_HP;
        this.pvz_lastShootTime = 0;
        this.pvz_attackRate = PVZ_Config.COMBAT.PLANT_ATTACK_RATE;

        this.setOrigin(0.5, 1);
    }

    update(time, delta) {
        if (this.pvz_isDead) return;

        // Solo dispara si hay enemigos en la fila
        if (this.pvz_shouldShoot(time)) {
            this.pvz_shoot();
        }
    }

    /**
     * Verifica si debe disparar basándose en el tiempo y enemigos en la fila
     */
    pvz_shouldShoot(time) {
        if (time < this.pvz_lastShootTime + this.pvz_attackRate) return false;

        // Comprobar si hay zombies en esta fila (implementado en la escena)
        return this.scene.pvz_hasEnemiesInRow(this.pvz_row);
    }

    /**
     * Lógica de disparo
     */
    pvz_shoot() {
        this.pvz_lastShootTime = this.scene.time.now;

        // Solicitar proyectil a la escena (que gestiona el pool)
        this.scene.pvz_spawnProjectile(this.x + 20, this.y - 40);

        // Pequeño feedback visual
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.2,
            scaleY: 0.8,
            duration: 100,
            yoyo: true
        });
    }
}

window.PVZ_Plant = PVZ_Plant;
