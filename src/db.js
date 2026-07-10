// ── INDEXEDDB — Base de datos local para modo offline ──────────────────────────
const DB_NAME = "controlcredit_offline";
const DB_VERSION = 1;

const STORES = ["clientes", "creditos", "productos", "ventas_contado", "cola_sync"];

let db = null;

export const initDB = () =>
  new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      STORES.forEach((store) => {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: "id" });
        }
      });
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });

// Guardar array completo en un store
export const saveToLocal = async (store, items) => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readwrite");
    const s = tx.objectStore(store);
    s.clear();
    items.forEach((item) => s.put(item));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};

// Leer todo de un store
export const getFromLocal = async (store) => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
};

// Actualizar un item específico en local
export const updateLocal = async (store, item) => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readwrite");
    tx.objectStore(store).put(item);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};

// ── COLA DE SINCRONIZACIÓN ────────────────────────────────────────────────────
// Guarda operaciones que se hicieron offline para sincronizar después
export const agregarACola = async (operacion) => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const item = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      ...operacion,
    };
    const tx = database.transaction("cola_sync", "readwrite");
    tx.objectStore("cola_sync").put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
};

export const obtenerCola = async () => {
  return getFromLocal("cola_sync");
};

export const limpiarItemCola = async (id) => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("cola_sync", "readwrite");
    tx.objectStore("cola_sync").delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};

export const limpiarCola = async () => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("cola_sync", "readwrite");
    tx.objectStore("cola_sync").clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};
