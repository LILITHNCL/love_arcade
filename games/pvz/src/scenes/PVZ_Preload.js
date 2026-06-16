/**
 * PVZ_Preload.js
 * Escena para la carga de assets del juego.
 */

class PVZ_Preload extends Phaser.Scene {
    constructor() {
        super('PVZ_Preload');
    }

    preload() {
        console.log('[PVZ] Preloading assets...');

        // Placeholder para assets futuros
        // this.load.image('sun', 'assets/sun.png');
        // this.load.spritesheet('zombie', 'assets/zombie_walk.png', { frameWidth: 64, frameHeight: 64 });

        // Texto de carga
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Cargando...',
            style: {
                font: '20px Rajdhani',
                fill: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);

        // Generar texturas de marcador de posición
        this.pvz_generatePlaceholders();
    }

    pvz_generatePlaceholders() {
        // Planta
        let g = this.add.graphics();
        g.fillStyle(0x00aa00, 1);
        g.fillRect(0, 0, 40, 60);
        g.generateTexture('plant_placeholder', 40, 60);
        g.clear();

        // Zombie
        g.fillStyle(0x777777, 1);
        g.fillRect(0, 0, 40, 70);
        g.generateTexture('zombie_placeholder', 40, 70);
        g.clear();

        // Proyectil
        g.fillStyle(0x00ff00, 1);
        g.fillCircle(8, 8, 8);
        g.generateTexture('pea_placeholder', 16, 16);
        g.destroy();
    }

    create() {
        console.log('[PVZ] Preload complete');
        this.scene.start('PVZ_Game');
    }
}

window.PVZ_Preload = PVZ_Preload;
