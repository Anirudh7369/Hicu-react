// src/crypto/publicKeyManager.js
// RSA public/private key pair management for secure key exchange

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const PRIVATE_KEY_STORE = 'userPrivateKey';
const PUBLIC_KEY_STORE = 'userPublicKey';

/**
 * Generate RSA-OAEP key pair for encryption
 * @returns {Promise<{publicKey: CryptoKey, privateKey: CryptoKey}>}
 */
async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048, // 2048-bit RSA
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  return keyPair;
}

/**
 * Export public key to base64 for storage in Firestore
 * @param {CryptoKey} publicKey - Public key
 * @returns {Promise<string>} - Base64-encoded public key
 */
async function exportPublicKey(publicKey) {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  const exportedAsBase64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  return exportedAsBase64;
}

/**
 * Import public key from base64
 * @param {string} publicKeyBase64 - Base64-encoded public key
 * @returns {Promise<CryptoKey>} - Public key
 */
async function importPublicKey(publicKeyBase64) {
  const binaryDer = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0));

  const publicKey = await crypto.subtle.importKey(
    'spki',
    binaryDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );

  return publicKey;
}

/**
 * Export private key to base64 for storage in IndexedDB
 * @param {CryptoKey} privateKey - Private key
 * @returns {Promise<string>} - Base64-encoded private key
 */
async function exportPrivateKey(privateKey) {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  const exportedAsBase64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  return exportedAsBase64;
}

/**
 * Import private key from base64
 * @param {string} privateKeyBase64 - Base64-encoded private key
 * @returns {Promise<CryptoKey>} - Private key
 */
async function importPrivateKey(privateKeyBase64) {
  const binaryDer = Uint8Array.from(atob(privateKeyBase64), (c) => c.charCodeAt(0));

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );

  return privateKey;
}

/**
 * Store key pair in localStorage (LOCAL ONLY - never sent to server)
 * @param {string} privateKeyBase64 - Base64-encoded private key
 * @param {string} publicKeyBase64 - Base64-encoded public key
 * @returns {Promise<void>}
 */
async function storeKeyPairLocally(privateKeyBase64, publicKeyBase64) {
  localStorage.setItem(PRIVATE_KEY_STORE, privateKeyBase64);
  localStorage.setItem(PUBLIC_KEY_STORE, publicKeyBase64);
}

/**
 * Get private key from localStorage
 * @returns {Promise<string|null>} - Base64-encoded private key or null
 */
async function getPrivateKeyLocally() {
  return localStorage.getItem(PRIVATE_KEY_STORE);
}

/**
 * Get public key from localStorage
 * @returns {Promise<string|null>} - Base64-encoded public key or null
 */
async function getPublicKeyLocally() {
  return localStorage.getItem(PUBLIC_KEY_STORE);
}

/**
 * Initialize user's RSA key pair (generate if doesn't exist)
 * @param {string} userEmail - User's email
 * @returns {Promise<{publicKey: CryptoKey, privateKey: CryptoKey}>}
 */
export async function initializeUserKeyPair(userEmail) {
  // Check if we already have keys stored locally
  const storedPrivateKey = await getPrivateKeyLocally();
  const storedPublicKey = await getPublicKeyLocally();

  if (storedPrivateKey && storedPublicKey) {
    console.log('🔑 Found existing RSA key pair in local storage');

    // Import the keys
    const privateKey = await importPrivateKey(storedPrivateKey);
    const publicKey = await importPublicKey(storedPublicKey);

    // Make sure public key is also in Firestore (re-upload if missing)
    const userRef = doc(db, 'users', userEmail.toLowerCase());
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists() || !userSnap.data().publicKey) {
      console.log('📤 Re-uploading public key to Firestore...');
      await setDoc(
        userRef,
        {
          publicKey: storedPublicKey,
          publicKeyUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    return { publicKey, privateKey };
  }

  // No key pair exists - generate new one
  console.log('🔑 Generating new RSA key pair...');
  const keyPair = await generateKeyPair();

  // Export keys
  const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
  const privateKeyBase64 = await exportPrivateKey(keyPair.privateKey);

  // Store keys LOCALLY (private key never sent to server)
  await storeKeyPairLocally(privateKeyBase64, publicKeyBase64);

  // Store public key in Firestore (safe to be public)
  const userRef = doc(db, 'users', userEmail.toLowerCase());
  await setDoc(
    userRef,
    {
      publicKey: publicKeyBase64,
      publicKeyUpdatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log('✅ RSA key pair generated and stored');

  return keyPair;
}

/**
 * Get another user's public key from Firestore
 * @param {string} userEmail - User's email
 * @returns {Promise<CryptoKey>} - Public key
 */
export async function getUserPublicKey(userEmail) {
  const userRef = doc(db, 'users', userEmail.toLowerCase());
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists() || !userSnap.data().publicKey) {
    throw new Error(`Public key not found for user: ${userEmail}`);
  }

  const publicKeyBase64 = userSnap.data().publicKey;
  return await importPublicKey(publicKeyBase64);
}

/**
 * Get current user's private key from local storage
 * @returns {Promise<CryptoKey>} - Private key
 */
export async function getMyPrivateKey() {
  const privateKeyBase64 = await getPrivateKeyLocally();

  if (!privateKeyBase64) {
    throw new Error('Private key not found. Please re-login to generate key pair.');
  }

  return await importPrivateKey(privateKeyBase64);
}

/**
 * Encrypt data with recipient's public key
 * @param {Uint8Array} data - Data to encrypt
 * @param {CryptoKey} publicKey - Recipient's public key
 * @returns {Promise<string>} - Base64-encoded encrypted data
 */
export async function encryptWithPublicKey(data, publicKey) {
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    publicKey,
    data
  );

  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

/**
 * Decrypt data with own private key
 * @param {string} encryptedBase64 - Base64-encoded encrypted data
 * @param {CryptoKey} privateKey - Own private key
 * @returns {Promise<Uint8Array>} - Decrypted data
 */
export async function decryptWithPrivateKey(encryptedBase64, privateKey) {
  const encrypted = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP',
    },
    privateKey,
    encrypted
  );

  return new Uint8Array(decrypted);
}
