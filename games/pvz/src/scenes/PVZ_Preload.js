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

        // Carga dinámica desde PVZ_Config.ASSETS
        Object.values(PVZ_Config.ASSETS).forEach(asset => {
            if (asset.type === 'image') {
                this.load.image(asset.key, asset.path);
            }
            // Futuro: soportar spritesheets, audio, etc.
        });

        // Escuchar errores de carga para activar fallbacks
        this.load.on('loaderror', (fileObj) => {
            console.warn(`[PVZ] Error cargando: ${fileObj.key}. Usando fallback.`);
            this.pvz_createFallback(fileObj.key);
        });

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

        // Pre-generar placeholders para asegurar que existan incluso si falla el cargador
        // y el listener 'loaderror' tiene race conditions
        this.pvz_generatePlaceholders();
    }

    pvz_generatePlaceholders() {
        // Crear texturas de fallback para todos los assets definidos
        // Esto asegura que siempre haya algo que mostrar incluso si la carga falla
        Object.values(PVZ_Config.ASSETS).forEach(asset => {
            this.pvz_createFallback(asset.key);
        });
    }

    /**
     * Crea una textura básica de color si el asset real falla
     */
    pvz_createFallback(key) {
        // Si ya existe la textura (porque se cargó bien), no sobreescribir
        if (this.textures.exists(key) && this.textures.get(key).key !== '__MISSING') {
            return;
        }

        // Buscar info del asset en la config
        const assetInfo = Object.values(PVZ_Config.ASSETS).find(a => a.key === key);
        const color = assetInfo ? assetInfo.fallbackColor : 0xff00ff;

        const g = this.add.graphics();
        g.fillStyle(color, 1);

        if (key.includes('plant')) {
            g.fillRect(0, 0, 40, 60);
            g.generateTexture(key, 40, 60);
        } else if (key.includes('zombie')) {
            g.fillRect(0, 0, 40, 70);
            g.generateTexture(key, 40, 70);
        } else if (key.includes('pea')) {
            g.fillCircle(8, 8, 8);
            g.generateTexture(key, 16, 16);
        } else if (key.includes('sun')) {
            g.fillCircle(15, 15, 15);
            g.generateTexture(key, 30, 30);
        } else if (key.includes('ui')) {
            g.fillRect(0, 0, 40, 40);
            g.generateTexture(key, 40, 40);
        } else {
            // Fondo o genérico
            g.fillRect(0, 0, 32, 32);
            g.generateTexture(key, 32, 32);
        }

        g.destroy();
    }

    create() {
        console.log('[PVZ] Preload complete');
        this.scene.start('PVZ_Game');
    }
}

window.PVZ_Preload = PVZ_Preload;
