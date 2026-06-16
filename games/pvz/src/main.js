/**
 * main.js
 * Punto de entrada del juego PVZ Arcade.
 */

window.addEventListener('load', () => {
    const config = {
        type: Phaser.AUTO,
        parent: 'game-container',
        width: PVZ_Config.WIDTH,
        height: PVZ_Config.HEIGHT,
        backgroundColor: '#1a1a1a',
        pixelArt: true,
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 0 },
                debug: false
            }
        },
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        scene: [
            PVZ_Boot,
            PVZ_Preload,
            PVZ_Game
        ]
    };

    // Inicializar el juego
    const game = new Phaser.Game(config);

    // Almacenar instancia si es necesario para depuración
    window.PVZ_GameInstance = game;

    console.log('[PVZ] Motor Phaser 3 inicializado');
});
