/**
 * PVZ_PauseMenu.js
 * Menú de pausa simple.
 */

class PVZ_PauseMenu extends Phaser.Scene {
    constructor() {
        super('PVZ_PauseMenu');
    }

    create() {
        const { WIDTH, HEIGHT } = PVZ_Config;

        // Fondo semi-transparente
        this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.7).setOrigin(0);

        const container = this.add.container(WIDTH / 2, HEIGHT / 2);

        const title = this.add.text(0, -100, 'PAUSA', {
            font: 'bold 48px Rajdhani',
            fill: '#ffffff'
        }).setOrigin(0.5);

        // Botón Continuar
        const resumeBtn = this.pvz_createButton(0, 0, 'CONTINUAR', () => {
            this.scene.resume('PVZ_Game');
            this.scene.stop();
        });

        // Botón Salir
        const exitBtn = this.pvz_createButton(0, 80, 'SALIR AL MENÚ', () => {
            window.location.href = '../../index.html';
        });

        container.add([title, resumeBtn, exitBtn]);
    }

    pvz_createButton(x, y, text, callback) {
        const btn = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 250, 50, 0x2d5a27).setInteractive({ useHandCursor: true });
        const txt = this.add.text(0, 0, text, { font: 'bold 20px Rajdhani', fill: '#ffffff' }).setOrigin(0.5);

        bg.on('pointerdown', callback);
        bg.on('pointerover', () => bg.setFillStyle(0x3d7a37));
        bg.on('pointerout', () => bg.setFillStyle(0x2d5a27));

        btn.add([bg, txt]);
        return btn;
    }
}

window.PVZ_PauseMenu = PVZ_PauseMenu;
