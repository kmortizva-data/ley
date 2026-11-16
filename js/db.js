// Thin promise wrapper over IndexedDB. All data stays on the device.

const DB_NAME = 'ley';
const DB_VERSION = 1;
const STORES = {
  sessions: { keyPath: 'id', autoIncrement: true },
  weights: { keyPath: 'date' },
  kv: { keyPath: 'key' },
};

let dbPromise;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const [name, options] of Object.entries(STORES)) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, options);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(store, mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const getAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const put = (store, value) => run(store, 'readwrite', (s) => s.put(value));
export const remove = (store, key) => run(store, 'readwrite', (s) => s.delete(key));
export const clear = (store) => run(store, 'readwrite', (s) => s.clear());

export async function getValue(key, fallback = null) {
  const row = await run('kv', 'readonly', (s) => s.get(key));
  return row ? row.value : fallback;
}

export const setValue = (key, value) => put('kv', { key, value });

/** Everything in one plain object, for the backup file. */
export async function exportAll() {
  const [sessions, weights, kv] = await Promise.all(Object.keys(STORES).map(getAll));
  return { app: 'ley', version: DB_VERSION, exportedAt: new Date().toISOString(), sessions, weights, kv };
}

/** Replace all data with a backup. Throws when the file is not a backup of this app. */
export async function importAll(data) {
  if (data?.app !== 'ley' || !Array.isArray(data.sessions) || !Array.isArray(data.weights) || !Array.isArray(data.kv)) {
    throw new Error('not a backup of this app');
  }
  for (const name of Object.keys(STORES)) {
    await clear(name);
    for (const row of data[name]) await put(name, row);
  }
}

export async function wipe() {
  for (const name of Object.keys(STORES)) await clear(name);
}
