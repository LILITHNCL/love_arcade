/**
 * PVZ_Projectile.js
 * Clase para los proyectiles (guisantes).
 * Diseñada para ser usada con Object Pooling.
 */

class PVZ_Projectile extends PVZ_Entity {
    constructor(scene, x, y) {
        // Usaremos un rectángulo verde como placeholder si no hay textura
        super(scene, x, y, 'pea_placeholder');

        // Atributos de proyectil
        this.pvz_damage = PVZ_Config.COMBAT.PROJECTILE_DAMAGE;
        this.pvz_speed = PVZ_Config.COMBAT.PROJECTILE_SPEED;
    }

    /**
     * Activa el proyectil (usado al sacar del pool)
     */
    fire(x, y) {
        this.setPosition(x, y);
        this.setActive(true);
        this.setVisible(true);
        this.pvz_isDead = false;
    }

    update(time, delta) {
        if (!this.active) return;

        // Movimiento lineal simple
        this.x += (this.pvz_speed * delta) / 1000;

        // Auto-desactivar si sale de la pantalla
        if (this.x > PVZ_Config.WIDTH + 50) {
            this.deactivate();
        }
    }

    /**
     * Desactiva el proyectil y lo devuelve al pool (no lo destruye)
     */
    deactivate() {
        this.setActive(false);
        this.setVisible(false);
        this.pvz_isDead = true;
    }
}

window.PVZ_Projectile = PVZ_Projectile;
