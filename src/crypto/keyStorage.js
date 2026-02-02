// src/crypto/keyStorage.js
// IndexedDB storage for chat encryption keys (client-side only)

const DB_NAME = 'HicuChatKeys';
const DB_VERSION = 1;
const STORE_NAME = 'chatKeys';

/**
 * Initialize IndexedDB for key storage
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object store for chat keys
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'chatId' });
      }
    };
  });
}

/**
 * Store encryption key for a chat (LOCAL ONLY - never sent to server)
 * @param {string} chatId - Chat ID
 * @param {Uint8Array} keyBytes - Raw encryption key bytes
 * @returns {Promise<void>}
 */
export async function storeKey(chatId, keyBytes) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.put({
      chatId,
      key: Array.from(keyBytes), // Store as array for IndexedDB compatibility
      createdAt: Date.now(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve encryption key for a chat
 * @param {string} chatId - Chat ID
 * @returns {Promise<Uint8Array|null>} - Raw key bytes or null if not found
 */
export async function getKey(chatId) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.get(chatId);

    request.onsuccess = () => {
      const result = request.result;
      if (result && result.key) {
        resolve(new Uint8Array(result.key));
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if a key exists for a chat
 * @param {string} chatId - Chat ID
 * @returns {Promise<boolean>}
 */
export async function hasKey(chatId) {
  const key = await getKey(chatId);
  return key !== null;
}

/**
 * Delete encryption key for a chat
 * @param {string} chatId - Chat ID
 * @returns {Promise<void>}
 */
export async function deleteKey(chatId) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.delete(chatId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all stored chat IDs (for backup/export)
 * @returns {Promise<string[]>}
 */
export async function getAllChatIds() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAllKeys();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Export all keys as JSON (for backup)
 * @returns {Promise<Object>} - Object with chatId -> base64 key mapping
 */
export async function exportAllKeys() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result;
      const exported = {};

      results.forEach((item) => {
        const keyBytes = new Uint8Array(item.key);
        const keyBase64 = btoa(String.fromCharCode(...keyBytes));
        exported[item.chatId] = keyBase64;
      });

      resolve(exported);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Import keys from JSON backup
 * @param {Object} keysObject - Object with chatId -> base64 key mapping
 * @returns {Promise<void>}
 */
export async function importKeys(keysObject) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    let completed = 0;
    const total = Object.keys(keysObject).length;

    if (total === 0) {
      resolve();
      return;
    }

    Object.entries(keysObject).forEach(([chatId, keyBase64]) => {
      const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));

      const request = store.put({
        chatId,
        key: Array.from(keyBytes),
        createdAt: Date.now(),
      });

      request.onsuccess = () => {
        completed++;
        if (completed === total) {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * Clear all stored keys (dangerous - use with caution)
 * @returns {Promise<void>}
 */
export async function clearAllKeys() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
