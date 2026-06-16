/**
 * PVZ_Victory.js
 */

class PVZ_Victory extends Phaser.Scene {
    constructor() {
        super('PVZ_Victory');
    }

    create() {
        const { WIDTH, HEIGHT } = PVZ_Config;
        this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x005500, 0.8).setOrigin(0);

        const container = this.add.container(WIDTH / 2, HEIGHT / 2);

        this.add.text(0, -100, '¡VICTORIA!', {
            font: 'bold 64px Rajdhani',
            fill: '#ffff00',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(0, -30, 'HAS DEFENDIDO TU JARDÍN', {
            font: 'bold 24px Rajdhani',
            fill: '#ffffff'
        }).setOrigin(0.5);

        const restartBtn = this.pvz_createButton(0, 50, 'NUEVA PARTIDA', () => {
            this.scene.start('PVZ_Game');
        });

        const exitBtn = this.pvz_createButton(0, 120, 'SALIR', () => {
            window.location.href = '../../index.html';
        });

        container.add([restartBtn, exitBtn]);
    }

    pvz_createButton(x, y, text, callback) {
        const btn = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 200, 50, 0x000000, 0.5).setInteractive({ useHandCursor: true });
        bg.setStrokeStyle(2, 0xffffff);
        const txt = this.add.text(0, 0, text, { font: 'bold 20px Rajdhani', fill: '#ffffff' }).setOrigin(0.5);

        bg.on('pointerdown', callback);
        btn.add([bg, txt]);
        return btn;
    }
}

window.PVZ_Victory = PVZ_Victory;
