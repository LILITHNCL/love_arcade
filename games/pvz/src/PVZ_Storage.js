/**
 * PVZ_Storage.js
 * Gestión de persistencia local para progreso interno del juego.
 */

const PVZ_Storage = {
    /**
     * Obtiene el estado guardado o inicializa uno nuevo
     */
    pvz_getData() {
        const raw = localStorage.getItem(PVZ_Config.STORAGE.KEY);
        if (raw) {
            try {
                return JSON.parse(raw);
            } catch (e) {
                console.error('[PVZ] Error al parsear storage', e);
            }
        }

        // Estado inicial por defecto
        return {
            unlockedPlants: ['PLANT_BASIC'],
            levelsCompleted: 0
        };
    },

    /**
     * Guarda los datos en localStorage
     */
    pvz_saveData(data) {
        localStorage.setItem(PVZ_Config.STORAGE.KEY, JSON.stringify(data));
    },

    /**
     * Comprueba si una planta está desbloqueada
     */
    pvz_isPlantUnlocked(plantKey) {
        const data = this.pvz_getData();
        return data.unlockedPlants.includes(plantKey);
    },

    /**
     * Desbloquea una nueva planta
     */
    pvz_unlockPlant(plantKey) {
        const data = this.pvz_getData();
        if (!data.unlockedPlants.includes(plantKey)) {
            data.unlockedPlants.push(plantKey);
            this.pvz_saveData(data);
            console.log(`[PVZ] Planta desbloqueada: ${plantKey}`);
        }
    }
};

window.PVZ_Storage = PVZ_Storage;
