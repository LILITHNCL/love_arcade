const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');

function createSandbox() {
    const storage = new Map();
    const document = { writes: [], write(value) { this.writes.push(value); } };
    const context = vm.createContext({
         window: {}, document, localStorage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, String(value)),
            removeItem: (key) => storage.delete(key),
            clear: () => storage.clear(),
        },
        console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Date,
        setTimeout, clearTimeout,
        Promise
    });
    context.window.window = context.window;
    
    return { context, storage, document };
}

function loadFiles(context, files) {
    for (const file of files) {
        vm.runInContext(read(file), context, { filename: file });
    }
}

module.exports = {
    read,
    createSandbox,
    loadFiles
};
