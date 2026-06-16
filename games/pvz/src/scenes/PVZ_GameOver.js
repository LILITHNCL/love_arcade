/**
 * PVZ_GameOver.js
 */

class PVZ_GameOver extends Phaser.Scene {
    constructor() {
        super('PVZ_GameOver');
    }

    create() {
        const { WIDTH, HEIGHT } = PVZ_Config;
        this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x550000, 0.8).setOrigin(0);

        const container = this.add.container(WIDTH / 2, HEIGHT / 2);

        this.add.text(0, -100, '¡LOS ZOMBIES SE COMIERON\nTU CEREBRO!', {
            font: 'bold 32px Rajdhani',
            fill: '#ff0000',
            align: 'center'
        }).setOrigin(0.5);

        const restartBtn = this.pvz_createButton(0, 50, 'REINTENTAR', () => {
            // Detener todas las escenas activas para un reinicio limpio
            this.scene.stop('PVZ_UI');
            this.scene.start('PVZ_Game');
        });

        const exitBtn = this.pvz_createButton(0, 120, 'SALIR', () => {
            window.location.href = '../../index.html';
        });

        container.add([restartBtn, exitBtn]);
    }

    pvz_createButton(x, y, text, callback) {
        const btn = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 200, 50, 0x2d5a27, 1).setInteractive({ useHandCursor: true });
        bg.setStrokeStyle(2, 0xffffff);
        const txt = this.add.text(0, 0, text, { font: 'bold 20px Rajdhani', fill: '#ffffff' }).setOrigin(0.5);

        bg.on('pointerdown', () => {
            bg.setFillStyle(0x1e3d1a);
            this.time.delayedCall(100, callback);
        });

        bg.on('pointerover', () => bg.setAlpha(0.8));
        bg.on('pointerout', () => bg.setAlpha(1));

        btn.add([bg, txt]);
        return btn;
    }
}

window.PVZ_GameOver = PVZ_GameOver;
