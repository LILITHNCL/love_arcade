import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { createSandbox, loadFiles } from '../helpers/vm-sandbox.cjs';

const FILES = [
    'js/core/config.js',
    'js/core/state-store.js',
    'js/domain/history.js'
];

describe('QA (F2a): Historial (TKT-003)', () => {
    it('dado varias transacciones, cuando se leen, entonces se devuelven en orden cronológico inverso', () => {
        const { context, setMockNow } = createSandbox();
        loadFiles(context, FILES);
        const historyObj = context.window.LoveArcadeHistory;

        setMockNow(1000);
        historyObj.logTransaction('ingreso', 10, 'A');
        setMockNow(2000);
        historyObj.logTransaction('gasto', 5, 'B');
        
        const history = historyObj.getHistory();
        assert.equal(history.length, 2);
        assert.equal(history[0].motivo, 'B');
        assert.equal(history[0].fecha, 2000);
        assert.equal(history[1].motivo, 'A');
        assert.equal(history[1].fecha, 1000);
    });

    it('dado más de 50 transacciones, cuando se registran, entonces mantiene un tope de 50', () => {
        const { context } = createSandbox();
        loadFiles(context, FILES);
        const historyObj = context.window.LoveArcadeHistory;

        for (let i = 0; i < 55; i++) {
            historyObj.logTransaction('ingreso', 1, `Tx ${i}`);
        }
        
        const history = historyObj.getHistory();
        assert.equal(history.length, 50, 'El historial debe estar limitado a 50 elementos');
        // El primer elemento al invertirlo debe ser el último insertado ('Tx 54')
        assert.equal(history[0].motivo, 'Tx 54');
        // El último elemento debe ser el 6to insertado ('Tx 5') porque 0-4 se borraron
        assert.equal(history[49].motivo, 'Tx 5');
    });

    it('dado entradas inválidas (sin inicializar el array), cuando se loguea, entonces lo inicializa', () => {
        const { context } = createSandbox();
        loadFiles(context, FILES);
        const storeObj = context.window.LoveArcadeStore;
        const historyObj = context.window.LoveArcadeHistory;

        // Romper explícitamente el array de historia para simular un estado corrupto
        const store = storeObj.getStore();
        store.history = null;
        storeObj.replaceStore(store);

        // logTransaction debería recrear el array
        historyObj.logTransaction('ingreso', 100, 'Reinicio');

        const history = historyObj.getHistory();
        assert.equal(history.length, 1);
        assert.equal(history[0].motivo, 'Reinicio');
    });
});
