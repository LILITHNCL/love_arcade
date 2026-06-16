/**
 * PVZ_Entity.js
 * Clase base para todas las entidades (plantas, zombies, proyectiles).
 * Implementa un patrón para gestión eficiente de memoria.
 */

class PVZ_Entity extends Phaser.GameObjects.Sprite {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {string} texture
     * @param {string|number} frame
     */
    constructor(scene, x, y, texture, frame) {
        super(scene, x, y, texture, frame);

        // Añadir a la escena
        scene.add.existing(this);

        // Atributos base
        this.pvz_hp = 100;
        this.pvz_isDead = false;

        // Registrar para limpieza automática al destruir la escena
        this.scene.events.once('shutdown', this.destroy, this);
    }

    /**
     * Lógica de actualización de la entidad
     */
    update(time, delta) {
        if (this.pvz_isDead) return;
        // Lógica personalizada en clases hijas
    }

    /**
     * Recibir daño
     * @param {number} amount
     */
    takeDamage(amount) {
        this.pvz_hp -= amount;
        if (this.pvz_hp <= 0) {
            this.die();
        }
    }

    /**
     * Muerte de la entidad y limpieza
     */
    die() {
        if (this.pvz_isDead) return;
        this.pvz_isDead = true;

        // Animación de muerte o efecto (opcional)

        // Eliminar de la escena
        this.destroy();
    }

    /**
     * Limpieza completa para evitar fugas de memoria
     */
    destroy(fromScene) {
        // Remover listeners personalizados si existen
        this.scene.events.off('shutdown', this.destroy, this);

        super.destroy(fromScene);
    }
}

// Exponer globalmente
window.PVZ_Entity = PVZ_Entity;
