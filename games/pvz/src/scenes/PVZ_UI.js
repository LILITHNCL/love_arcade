/**
 * PVZ_UI.js
 * Escena de UI superpuesta para gestión de recursos y selección de plantas.
 */

class PVZ_UI extends Phaser.Scene {
    constructor() {
        super({ key: 'PVZ_UI', active: false });
    }

    create() {
        this.gameScene = this.scene.get('PVZ_Game');

        // Contenedor principal de la UI
        this.pvz_uiContainer = this.add.container(0, 0);

        // 1. Contador de Soles
        this.pvz_drawSunCounter();

        // 2. Selector de Plantas (Cards)
        this.pvz_drawPlantSelector();

        // 3. Botón de Pausa
        this.pvz_drawPauseButton();
    }

    pvz_drawSunCounter() {
        const bg = this.add.rectangle(20, 20, 100, 40, 0x000000, 0.5).setOrigin(0);
        const icon = this.add.image(40, 40, PVZ_Config.ASSETS.SUN.key).setScale(0.8);

        this.pvz_sunText = this.add.text(65, 40, '0', {
            font: 'bold 20px Rajdhani',
            fill: '#ffff00'
        }).setOrigin(0, 0.5);

        this.pvz_uiContainer.add([bg, icon, this.pvz_sunText]);
    }

    pvz_drawPlantSelector() {
        const startX = 140;
        const startY = 20;
        const spacing = 70;

        // Card para Planta Básica
        this.pvz_plantCard = this.add.container(startX, startY);

        const cardBg = this.add.rectangle(0, 0, 60, 80, 0x555555, 0.8).setOrigin(0);
        cardBg.setStrokeStyle(2, 0xffffff, 1);

        const plantIcon = this.add.image(30, 30, PVZ_Config.ASSETS.PLANT_BASIC.key).setScale(0.5);

        const costText = this.add.text(30, 65, PVZ_Config.ECONOMY.PLANT_COSTS.PLANT_BASIC, {
            font: 'bold 16px Rajdhani',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.pvz_plantCard.add([cardBg, plantIcon, costText]);
        this.pvz_uiContainer.add(this.pvz_plantCard);

        // Interactividad
        cardBg.setInteractive({ useHandCursor: true });

        cardBg.on('pointerdown', () => {
            this.pvz_selectPlant('PLANT_BASIC');
        });

        // Estado visual de selección
        this.pvz_cardHighlight = this.add.rectangle(startX, startY, 60, 80)
            .setOrigin(0)
            .setStrokeStyle(3, 0xffff00)
            .setVisible(false);
        this.pvz_uiContainer.add(this.pvz_cardHighlight);
    }

    pvz_drawPauseButton() {
        const pauseBtn = this.add.image(PVZ_Config.WIDTH - 40, 40, PVZ_Config.ASSETS.UI_PAUSE.key)
            .setInteractive({ useHandCursor: true })
            .setTint(0x2d5a27);

        pauseBtn.on('pointerdown', () => {
            this.gameScene.scene.pause();
            this.scene.launch('PVZ_PauseMenu');
        });

        // Hover effect for mobile/desktop accessibility
        pauseBtn.on('pointerover', () => pauseBtn.setAlpha(0.8));
        pauseBtn.on('pointerout', () => pauseBtn.setAlpha(1));

        this.pvz_uiContainer.add(pauseBtn);
    }

    pvz_selectPlant(plantKey) {
        const cost = PVZ_Config.ECONOMY.PLANT_COSTS[plantKey];
        const currentSuns = this.gameScene.pvz_suns;

        if (currentSuns >= cost) {
            this.gameScene.pvz_selectedPlant = plantKey;
            this.pvz_cardHighlight.setVisible(true);
            console.log(`[PVZ] Planta seleccionada: ${plantKey}`);
        } else {
            // Feedback de "no hay dinero"
            this.cameras.main.shake(100, 0.005);
            console.log('[PVZ] No hay suficientes soles');
        }
    }

    update() {
        if (this.gameScene) {
            // Actualizar contador de soles
            this.pvz_sunText.setText(this.gameScene.pvz_suns);

            // Actualizar transparencia de cards si no alcanza el dinero
            const cost = PVZ_Config.ECONOMY.PLANT_COSTS.PLANT_BASIC;
            this.pvz_plantCard.setAlpha(this.gameScene.pvz_suns >= cost ? 1 : 0.5);

            // Ocultar highlight si ya no hay planta seleccionada en el juego
            if (!this.gameScene.pvz_selectedPlant) {
                this.pvz_cardHighlight.setVisible(false);
            }
        }
    }
}

window.PVZ_UI = PVZ_UI;
