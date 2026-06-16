/**
 * PVZ_Boot.js
 * Escena inicial para configuración del motor.
 */

class PVZ_Boot extends Phaser.Scene {
    constructor() {
        super('PVZ_Boot');
    }

    preload() {
        // Cargar assets mínimos para la barra de carga si fuera necesario
    }

    create() {
        console.log('[PVZ] Boot complete');
        this.scene.start('PVZ_Preload');
    }
}

window.PVZ_Boot = PVZ_Boot;
