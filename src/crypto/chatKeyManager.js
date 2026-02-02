// src/crypto/chatKeyManager.js
// Manages per-chat encryption keys (TRUE E2E - Keys NEVER sent to server)

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { importKey } from './mediaCrypto';
import { storeKey, getKey, hasKey as hasStoredKey, deleteKey } from './keyStorage';
import {
  getUserPublicKey,
  getMyPrivateKey,
  encryptWithPublicKey,
  decryptWithPrivateKey,
} from './publicKeyManager';

// Cache to prevent duplicate key generation for the same chat
const keyCachePromises = new Map();

/**
 * Generate a new 256-bit AES-GCM key
 * @returns {Promise<Uint8Array>} - Raw key bytes
 */
async function generateChatKey() {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // Export as raw bytes
  const exported = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(exported);
}

/**
 * Get or create encryption key for a chat (TRUE E2E - stored locally only)
 * @param {string} chatId - Chat ID
 * @param {string} myEmail - Current user's email (optional, for key package lookup)
 * @returns {Promise<CryptoKey>} - AES-GCM crypto key
 */
export async function getChatKey(chatId, myEmail = null) {
  // Check if there's already a pending key generation/retrieval for this chat
  if (keyCachePromises.has(chatId)) {
    console.log('⏳ Waiting for existing key generation/retrieval...');
    return keyCachePromises.get(chatId);
  }

  // Create a promise for this key retrieval/generation
  const keyPromise = (async () => {
    try {
      let rawKey = null;

      // FIRST: Check Firestore for chat data and key packages
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        throw new Error('Chat not found');
      }

      const chatData = chatSnap.data();

      // Priority 1: Check for encrypted key packages for current user (most secure)
      if (myEmail && chatData.keyPackages && chatData.keyPackages[myEmail.toLowerCase()]) {
        try {
          console.log('🔓 Found encrypted key package for current user, decrypting...');
          const encryptedPackage = chatData.keyPackages[myEmail.toLowerCase()];

          // Get my private key
          const myPrivateKey = await getMyPrivateKey();

          // Decrypt the chat key
          rawKey = await decryptWithPrivateKey(encryptedPackage, myPrivateKey);

          // Store locally for future use
          await storeKey(chatId, rawKey);

          console.log('✅ Successfully imported and decrypted key package');
          return importKey(rawKey);
        } catch (error) {
          console.error('Failed to decrypt key package:', error);
          // Fall through to check other sources
        }
      }

      // Priority 2: Check local storage (key we generated or previously decrypted)
      rawKey = await getKey(chatId);
      if (rawKey) {
        console.log('✅ Found existing key in local storage');

        // Validate: If chat has keyPackages but we're not in them, this might be an orphaned key
        if (chatData.keyPackages && myEmail) {
          const hasMyPackage = chatData.keyPackages[myEmail.toLowerCase()];
          if (!hasMyPackage) {
            console.warn('⚠️ Local key found but no key package exists for this user. This may be orphaned data.');
            // We'll still use it if we generated this chat's key ourselves
            // Check if we have the e2eeEnabled flag which means we generated it
            if (!chatData.e2eeEnabled) {
              console.warn('⚠️ Chat has no E2EE flag. Deleting potentially orphaned key and regenerating...');
              await deleteKey(chatId); // Clear the orphaned key
              rawKey = null; // Force regeneration
            }
          }
        }

        if (rawKey) {
          return importKey(rawKey);
        }
      }

      // Priority 3: Check for legacy Firestore key (migration path)
      if (chatData.encryptionKey) {
        console.warn('⚠️ Found legacy encryption key in Firestore. Migrating to local storage...');

        // Import the legacy key from Firestore
        rawKey = Uint8Array.from(atob(chatData.encryptionKey), (c) => c.charCodeAt(0));

        // Store locally
        await storeKey(chatId, rawKey);

        return importKey(rawKey);
      }

      // Priority 4: No key exists anywhere - generate new one for this chat
      console.log('🔑 No key found, generating new chat key...');
      rawKey = await generateChatKey();

      // Store locally (NEVER sent to Firestore)
      await storeKey(chatId, rawKey);

      // Share the key with all participants via encrypted key packages
      try {
        await shareKeyWithParticipants(chatId, rawKey, chatData.participants);
      } catch (error) {
        console.error('Failed to share key with participants:', error);
      }

      // Store a flag in Firestore indicating E2E is enabled (but NOT the key)
      await updateDoc(chatRef, {
        e2eeEnabled: true,
        e2eeVersion: 1,
      });

      return importKey(rawKey);
    } finally {
      // Clean up the cache after a short delay to allow concurrent calls to complete
      setTimeout(() => {
        keyCachePromises.delete(chatId);
      }, 1000);
    }
  })();

  // Store the promise in cache
  keyCachePromises.set(chatId, keyPromise);

  return keyPromise;
}

/**
 * Share encryption key with all chat participants
 * @param {string} chatId - Chat ID
 * @param {Uint8Array} rawKey - Raw chat encryption key
 * @param {Array<string>} participants - Array of participant emails
 */
async function shareKeyWithParticipants(chatId, rawKey, participants) {
  const chatRef = doc(db, 'chats', chatId);
  const keyPackages = {};

  for (const email of participants) {
    try {
      // Get participant's public key
      const publicKey = await getUserPublicKey(email);

      // Encrypt chat key with their public key
      const encryptedKey = await encryptWithPublicKey(rawKey, publicKey);

      keyPackages[email.toLowerCase()] = encryptedKey;
      console.log('🔐 Created key package for:', email);
    } catch (error) {
      console.error(`Failed to create key package for ${email}:`, error);
    }
  }

  // Store all encrypted key packages in Firestore
  await updateDoc(chatRef, {
    keyPackages,
    lastKeyUpdate: new Date().toISOString(),
  });

  console.log('✅ Shared encryption key with all participants');
}

/**
 * Check if a chat has an encryption key available locally
 * @param {string} chatId - Chat ID
 * @returns {Promise<boolean>} - True if key exists
 */
export async function chatHasKey(chatId) {
  return await hasStoredKey(chatId);
}

/**
 * Share encryption key with another user (RSA-encrypted for security)
 * @param {string} chatId - Chat ID
 * @param {string} recipientEmail - Email of recipient
 * @returns {Promise<string>} - Encrypted key package (JSON string)
 */
export async function createKeyPackage(chatId, recipientEmail) {
  const rawKey = await getKey(chatId);

  if (!rawKey) {
    throw new Error('No key found for this chat');
  }

  // Get recipient's public key from Firestore
  const recipientPublicKey = await getUserPublicKey(recipientEmail);

  // Encrypt the chat key with recipient's RSA public key
  const encryptedKey = await encryptWithPublicKey(rawKey, recipientPublicKey);

  console.log('🔐 Created encrypted key package for:', recipientEmail);

  return JSON.stringify({
    chatId,
    encryptedKey, // RSA-encrypted chat key
    recipient: recipientEmail,
    timestamp: Date.now(),
  });
}

/**
 * Import a key package from another user (RSA-decrypted)
 * @param {string} packageJson - Encrypted key package (JSON string)
 * @returns {Promise<void>}
 */
export async function importKeyPackage(packageJson) {
  const package_ = JSON.parse(packageJson);

  // Get my private key from local storage
  const myPrivateKey = await getMyPrivateKey();

  // Decrypt the chat key with my RSA private key
  const rawKey = await decryptWithPrivateKey(package_.encryptedKey, myPrivateKey);

  // Store the decrypted chat key locally
  await storeKey(package_.chatId, rawKey);

  console.log('🔓 Imported and decrypted key package for chat:', package_.chatId);
}
