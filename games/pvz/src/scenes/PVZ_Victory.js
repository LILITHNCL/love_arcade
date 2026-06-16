/**
 * PVZ_Victory.js
 */

class PVZ_Victory extends Phaser.Scene {
    constructor() {
        super('PVZ_Victory');
    }

    create(data) {
        const { WIDTH, HEIGHT } = PVZ_Config;
        this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x005500, 0.8).setOrigin(0);

        const container = this.add.container(WIDTH / 2, HEIGHT / 2);

        this.add.text(0, -120, '¡VICTORIA!', {
            font: 'bold 64px Rajdhani',
            fill: '#ffff00',
            align: 'center'
        }).setOrigin(0.5);

        this.add.text(0, -60, 'HAS DEFENDIDO TU JARDÍN', {
            font: 'bold 24px Rajdhani',
            fill: '#ffffff'
        }).setOrigin(0.5);

        // Recompensa Hub
        const reward = data.reward || 0;
        this.add.text(0, 0, `¡Has ganado ${reward} monedas para tu Hub!`, {
            font: '20px Rajdhani',
            fill: '#4ade80'
        }).setOrigin(0.5);

        // Lógica de desbloqueo (Demo)
        if (!PVZ_Storage.pvz_isPlantUnlocked('PLANT_FAST')) {
            PVZ_Storage.pvz_unlockPlant('PLANT_FAST');
            this.add.text(0, 30, '¡NUEVA PLANTA DESBLOQUEADA: LANZAGUISANTES RÁPIDO!', {
                font: 'bold 18px Rajdhani',
                fill: '#00ffff'
            }).setOrigin(0.5);
        }

        const restartBtn = this.pvz_createButton(0, 80, 'NUEVA PARTIDA', () => {
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

window.PVZ_Victory = PVZ_Victory;
