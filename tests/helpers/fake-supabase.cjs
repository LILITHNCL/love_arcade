const { createSandbox, loadFiles } = require('./vm-sandbox.cjs');

class FakeEvent {
    constructor(type) {
        this.type = type;
    }
}

class FakeCustomEvent extends FakeEvent {
    constructor(type, init = {}) {
        super(type);
        this.detail = init.detail;
    }
}

function createFakeSupabase(options = {}) {
    const tableData = new Map();
    let currentSession = options.initialSession || null;
    const authListeners = new Set();
    const upsertLog = [];
    let customUpsertError = null;
    let customSelectError = null;

    if (options.initialProfiles) {
        for (const [id, profile] of Object.entries(options.initialProfiles)) {
            tableData.set(id, { ...profile });
        }
    }

    const auth = {
        getSession: async () => ({
            data: { session: currentSession },
            error: null
        }),
        onAuthStateChange: (cb) => {
            authListeners.add(cb);
            return {
                data: {
                    subscription: {
                        unsubscribe: () => authListeners.delete(cb)
                    }
                }
            };
        },
        signInWithPassword: async ({ email }) => {
            const session = {
                user: { id: options.userId || 'test-user-id', email },
                access_token: 'fake-token-123'
            };
            currentSession = session;
            for (const listener of Array.from(authListeners)) {
                listener('SIGNED_IN', session);
            }
            return { data: { user: session.user, session }, error: null };
        },
        signOut: async () => {
            currentSession = null;
            for (const listener of Array.from(authListeners)) {
                listener('SIGNED_OUT', null);
            }
            return { error: null };
        }
    };

    function simulateSignIn(session) {
        currentSession = session;
        for (const listener of Array.from(authListeners)) {
            listener('SIGNED_IN', session);
        }
    }

    function simulateSignOut() {
        currentSession = null;
        for (const listener of Array.from(authListeners)) {
            listener('SIGNED_OUT', null);
        }
    }

    function from(tableName) {
        return {
            select: () => {
                let filterId = null;
                const builder = {
                    eq: (col, val) => {
                        if (col === 'id') filterId = val;
                        return builder;
                    },
                    maybeSingle: async () => {
                        if (customSelectError) {
                            return { data: null, error: customSelectError };
                        }
                        const record = filterId ? tableData.get(filterId) || null : null;
                        return { data: record, error: null };
                    },
                    single: async () => {
                        if (customSelectError) {
                            return { data: null, error: customSelectError };
                        }
                        const record = filterId ? tableData.get(filterId) || null : null;
                        if (!record) return { data: null, error: new Error('Record not found') };
                        return { data: record, error: null };
                    }
                };
                return builder;
            },
            upsert: async (record) => {
                upsertLog.push(record);
                if (customUpsertError) {
                    return { data: null, error: customUpsertError };
                }
                const id = record.id;
                const existing = tableData.get(id) || {};
                tableData.set(id, { ...existing, ...record });
                return { data: record, error: null };
            }
        };
    }

    return {
        auth,
        from,
        tableData,
        upsertLog,
        simulateSignIn,
        simulateSignOut,
        setUpsertError: (err) => { customUpsertError = err; },
        setSelectError: (err) => { customSelectError = err; },
        getCurrentSession: () => currentSession
    };
}

function setupSentinelSandbox(options = {}) {
    const sandbox = createSandbox();
    const { context, storage } = sandbox;

    const docListeners = new Map();
    const winListeners = new Map();

    function addListener(map, event, fn) {
        if (!map.has(event)) map.set(event, new Set());
        map.get(event).add(fn);
    }
    function removeListener(map, event, fn) {
        if (map.has(event)) map.get(event).delete(fn);
    }
    function dispatch(map, event) {
        const type = typeof event === 'string' ? event : event.type;
        if (map.has(type)) {
            for (const fn of Array.from(map.get(type))) {
                fn(event);
            }
        }
    }

    context.CustomEvent = FakeCustomEvent;
    context.Event = FakeEvent;
    context.window.CustomEvent = FakeCustomEvent;
    context.window.Event = FakeEvent;

    context.document.addEventListener = (ev, fn) => addListener(docListeners, ev, fn);
    context.document.removeEventListener = (ev, fn) => removeListener(docListeners, ev, fn);
    context.document.dispatchEvent = (ev) => dispatch(docListeners, ev);
    const domElements = new Map();
    context.document.getElementById = (id) => {
        if (!domElements.has(id)) {
            domElements.set(id, {
                id,
                style: {},
                classList: {
                    add: () => {},
                    remove: () => {},
                    toggle: () => {},
                    contains: () => false
                },
                textContent: '',
                value: '',
                setAttribute: () => {},
                getAttribute: () => null,
                addEventListener: () => {},
                removeEventListener: () => {},
                querySelectorAll: () => [],
                querySelector: () => null
            });
        }
        return domElements.get(id);
    };
    context.document.querySelectorAll = () => [];
    context.document.hidden = false;

    context.window.addEventListener = (ev, fn) => addListener(winListeners, ev, fn);
    context.window.removeEventListener = (ev, fn) => removeListener(winListeners, ev, fn);
    context.window.dispatchEvent = (ev) => dispatch(winListeners, ev);
    context.window.requestIdleCallback = (cb) => { cb(); return 1; };
    context.window.cancelIdleCallback = () => {};

    context.fetch = async (url) => {
        if (url === '/api/client-config') {
            return {
                ok: true,
                json: async () => ({
                    supabaseUrl: 'https://fake.supabase.co',
                    supabaseKey: 'fake-anon-key'
                })
            };
        }
        return { ok: false, status: 404 };
    };

    const fakeSupabase = createFakeSupabase(options);
    context.window.supabase = {
        createClient: () => fakeSupabase
    };

    if (options.initialStorage) {
        for (const [key, value] of Object.entries(options.initialStorage)) {
            storage.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        }
    }

    loadFiles(context, ['js/core/config.js', 'js/core/state-store.js', 'js/cloud/sentinel.js']);

    context.LoveArcadeStore = context.window.LoveArcadeStore;
    context.GameCenter = context.window.GameCenter;
    context.Sentinel = context.window.Sentinel;
    context.CONFIG = context.window.CONFIG;

    const dispatchDomLoaded = () => {
        context.document.dispatchEvent(new FakeEvent('DOMContentLoaded'));
    };

    const dispatchBeforeUnload = () => {
        context.window.dispatchEvent(new FakeEvent('beforeunload'));
    };

    async function login(session = { user: { id: 'test-user-1', email: 'test@example.com' } }) {
        let done = false;
        const authPromise = new Promise((resolve) => {
            const onAuth = () => {
                if (!done) {
                    done = true;
                    removeListener(docListeners, 'la:cloud-authenticated', onAuth);
                    resolve();
                }
            };
            addListener(docListeners, 'la:cloud-authenticated', onAuth);
            setTimeout(() => {
                if (!done) {
                    done = true;
                    removeListener(docListeners, 'la:cloud-authenticated', onAuth);
                    resolve();
                }
            }, 60);
        });
        fakeSupabase.simulateSignIn(session);
        await authPromise;
        await new Promise((resolve) => setTimeout(resolve, 15));
    }

    async function logout() {
        fakeSupabase.simulateSignOut();
        await new Promise((resolve) => setTimeout(resolve, 25));
    }

    return {
        context,
        storage,
        sandbox,
        fakeSupabase,
        login,
        logout,
        LoveArcadeStore: context.LoveArcadeStore,
        dispatchDomLoaded,
        dispatchBeforeUnload,
        SENTINEL_TS_KEY: 'love_arcade_sentinel_ts'
    };
}

module.exports = {
    createFakeSupabase,
    setupSentinelSandbox,
    FakeEvent,
    FakeCustomEvent
};
