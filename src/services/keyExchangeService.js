// src/services/keyExchangeService.js
// Secure key exchange for E2E encryption using RSA public key cryptography

import { collection, addDoc, query, where, onSnapshot, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { importKeyPackage } from '../crypto/chatKeyManager';

/**
 * Share encryption key with chat participant via Firestore
 * Uses RSA-OAEP public key encryption for secure key exchange
 *
 * Flow:
 * 1. Chat key (AES-256) is encrypted with recipient's RSA public key
 * 2. Encrypted package is stored in Firestore (only recipient can decrypt)
 * 3. Recipient decrypts with their RSA private key (stored locally)
 * 4. Even Firebase cannot see the chat key
 *
 * @param {string} chatId - Chat ID
 * @param {string} keyPackage - RSA-encrypted key package from createKeyPackage()
 * @param {Object} user - Current user object
 * @returns {Promise<void>}
 */
export async function shareKeyWithParticipant(chatId, keyPackage, user) {
  const keySharesRef = collection(db, 'chats', chatId, 'keyShares');

  await addDoc(keySharesRef, {
    type: 'keyShare',
    package: keyPackage,
    sharedBy: user.email?.toLowerCase(),
    createdAt: serverTimestamp(),
  });

  console.log('🔑 Encryption key shared with participant');
}

/**
 * Listen for shared keys from other participants
 * @param {string} chatId - Chat ID
 * @param {string} userEmail - Current user's email
 * @param {Function} onKeyReceived - Callback when key is received
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToKeyShares(chatId, userEmail, onKeyReceived) {
  const keySharesRef = collection(db, 'chats', chatId, 'keyShares');

  // Query for key shares not created by current user
  const q = query(
    keySharesRef,
    where('sharedBy', '!=', userEmail.toLowerCase()),
    orderBy('sharedBy'),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  return onSnapshot(q, async (snapshot) => {
    if (!snapshot.empty) {
      const keyShare = snapshot.docs[0].data();

      try {
        // Import the shared key
        await importKeyPackage(keyShare.package);
        console.log('🔑 Received and imported encryption key');

        if (onKeyReceived) {
          onKeyReceived();
        }
      } catch (error) {
        console.error('Failed to import shared key:', error);
      }
    }
  });
}
