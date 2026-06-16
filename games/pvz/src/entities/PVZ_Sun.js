/**
 * PVZ_Sun.js
 * Clase para el recurso Sol. Cae lentamente y debe ser recolectado.
 */

class PVZ_Sun extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, PVZ_Config.ASSETS.SUN.key);

        scene.add.existing(this);

        this.pvz_value = PVZ_Config.ECONOMY.SUN_VALUE;
        this.pvz_isCollected = false;
        this.pvz_targetY = y + Phaser.Math.Between(50, 150); // Cae un poco

        this.setInteractive({ useHandCursor: true });

        this.on('pointerdown', () => {
            this.pvz_collect();
        });

        // Animación de escala al aparecer
        this.setScale(0);
        scene.tweens.add({
            targets: this,
            scale: 1,
            duration: 500,
            ease: 'Back.easeOut'
        });

        // Registrar para limpieza
        this.scene.events.once('shutdown', this.destroy, this);
    }

    update(time, delta) {
        if (this.pvz_isCollected) return;

        // Caída lenta
        if (this.y < this.pvz_targetY) {
            this.y += (20 * delta) / 1000;
        }

        // Auto-destrucción tras un tiempo (10 segundos)
        if (!this.pvz_lifespan) {
            this.pvz_lifespan = time + 10000;
        }

        if (time > this.pvz_lifespan) {
            this.pvz_fadeAway();
        }
    }

    pvz_collect() {
        if (this.pvz_isCollected) return;
        this.pvz_isCollected = true;

        // Sonido/Efecto (Futuro)

        // Animación de recolecta hacia el contador de la UI
        this.scene.tweens.add({
            targets: this,
            x: 50,
            y: 50,
            scale: 0.5,
            duration: 600,
            ease: 'Power2',
            onComplete: () => {
                this.scene.pvz_suns += this.pvz_value;
                this.destroy();
            }
        });
    }

    pvz_fadeAway() {
        if (this.pvz_isCollected) return;
        this.pvz_isCollected = true;

        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            duration: 500,
            onComplete: () => this.destroy()
        });
    }

    destroy(fromScene) {
        this.scene.events.off('shutdown', this.destroy, this);
        super.destroy(fromScene);
    }
}

window.PVZ_Sun = PVZ_Sun;
