// src/crypto/mediaCrypto.js
// AES-GCM encryption/decryption utilities for media files

/**
 * Import a raw key for AES-GCM encryption/decryption
 * @param {Uint8Array} rawKey - 256-bit raw key
 * @returns {Promise<CryptoKey>} - Imported crypto key
 */
export async function importKey(rawKey) {
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a file using AES-GCM
 * @param {File|Blob} file - File to encrypt
 * @param {CryptoKey} key - AES-GCM crypto key
 * @returns {Promise<{blob: Blob, iv: string}>} - Encrypted blob and base64-encoded IV
 */
export async function encryptFile(file, key) {
  // Generate a random 12-byte initialization vector (IV)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();

  // Encrypt the file
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    buffer
  );

  return {
    blob: new Blob([encrypted]),
    iv: btoa(String.fromCharCode(...iv)), // Convert IV to base64 for storage
  };
}

/**
 * Decrypt a file using AES-GCM
 * @param {Blob} blob - Encrypted blob
 * @param {CryptoKey} key - AES-GCM crypto key
 * @param {string} ivBase64 - Base64-encoded IV
 * @returns {Promise<Blob>} - Decrypted blob
 */
export async function decryptFile(blob, key, ivBase64) {
  // Convert base64 IV back to Uint8Array
  const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));

  // Read encrypted blob as ArrayBuffer
  const buffer = await blob.arrayBuffer();

  // Decrypt the file
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    buffer
  );

  return new Blob([decrypted]);
}
