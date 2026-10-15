const { EventEmitter } = require('node:events');

/**
 * FakeRequest simula un IncomingMessage de Node / Vercel Serverless.
 * Soporta métodos, headers en minúsculas, body en distintos formatos
 * (objeto, string, Buffer, undefined) y eventos de stream ('data', 'end', 'error').
 */
class FakeRequest extends EventEmitter {
    constructor(options = {}) {
        super();
        this.method = options.method || 'GET';
        this.headers = {};
        if (options.headers) {
            for (const [key, value] of Object.entries(options.headers)) {
                this.headers[key.toLowerCase()] = value;
            }
        }
        this.body = options.body;
        if (options.rawStream !== undefined) {
            queueMicrotask(() => {
                if (Array.isArray(options.rawStream)) {
                    for (const chunk of options.rawStream) {
                        this.emit('data', Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
                    }
                } else if (options.rawStream !== null) {
                    const chunk = options.rawStream;
                    this.emit('data', Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
                }
                this.emit('end');
            });
        }
    }

    pushChunk(chunk) {
        this.emit('data', Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }

    endStream() {
        this.emit('end');
    }

    errorStream(err) {
        this.emit('error', err);
    }
}

/**
 * FakeResponse simula un ServerResponse de Node / Vercel Serverless.
 * Implementa status(code), setHeader(k, v), getHeader(k), json(data), end().
 */
class FakeResponse {
    constructor() {
        this.statusCode = 200;
        this.headers = {};
        this.body = undefined;
        this.ended = false;
    }

    status(code) {
        this.statusCode = code;
        return this;
    }

    setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
        return this;
    }

    getHeader(name) {
        return this.headers[name.toLowerCase()];
    }

    json(data) {
        this.body = data;
        this.ended = true;
        return this;
    }

    send(data) {
        this.body = data;
        this.ended = true;
        return this;
    }

    end(data) {
        if (data !== undefined) this.body = data;
        this.ended = true;
        return this;
    }
}

function createFakeReq(options = {}) {
    return new FakeRequest(options);
}

function createFakeRes() {
    return new FakeResponse();
}

module.exports = {
    FakeRequest,
    FakeResponse,
    createFakeReq,
    createFakeRes,
};
