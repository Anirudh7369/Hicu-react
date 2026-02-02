// src/services/chatMessagesService.js

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getChatKey } from '../crypto/chatKeyManager';
import { encryptText, decryptText } from '../crypto/textEncryption';

/**
 * Subscribe to messages in a specific chat (with automatic decryption)
 * @param {Object} params
 * @param {string} params.chatId - The chat ID
 * @param {string} params.userEmail - Current user's email (for key decryption)
 * @param {Function} params.onMessages - Callback with decrypted messages array
 * @param {Function} params.onError - Error callback
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToChatMessages({ chatId, userEmail, onMessages, onError }) {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    async (snapshot) => {
      try {
        // Get encryption key for this chat (with user's email for key package lookup)
        const chatKey = await getChatKey(chatId, userEmail);

        // Decrypt all messages
        const decryptedMessages = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();

            // If message has encrypted text, decrypt it
            if (data.encryptedText && data.textIv) {
              try {
                const decryptedText = await decryptText(data.encryptedText, data.textIv, chatKey);
                return {
                  id: docSnap.id,
                  ...data,
                  text: decryptedText, // Decrypted text
                  encrypted: true, // Flag to indicate it was encrypted
                };
              } catch (decryptError) {
                console.error('Failed to decrypt message:', decryptError);
                return {
                  id: docSnap.id,
                  ...data,
                  text: '[Decryption failed]',
                  decryptionError: true,
                };
              }
            }

            // Legacy unencrypted message (for backward compatibility)
            return {
              id: docSnap.id,
              ...data,
              encrypted: false,
            };
          })
        );

        onMessages(decryptedMessages);
      } catch (error) {
        console.error('Error in message subscription:', error);
        onError?.(error);
      }
    },
    (error) => onError?.(error)
  );
}

/**
 * Send an encrypted message in a specific chat
 * @param {Object} params
 * @param {string} params.chatId - The chat ID
 * @param {string} params.text - Message text (will be encrypted)
 * @param {Object} params.user - User object with uid, email, displayName, photoURL
 */
export async function sendChatMessage({ chatId, text, user }) {
  const trimmed = text.trim();
  if (!trimmed) return;

  // Get encryption key for this chat (with user's email for key package lookup/sharing)
  const chatKey = await getChatKey(chatId, user.email);

  // Encrypt the text message
  const { ciphertext, iv } = await encryptText(trimmed, chatKey);

  const messagesRef = collection(db, 'chats', chatId, 'messages');

  await addDoc(messagesRef, {
    encryptedText: ciphertext, // Encrypted text (stored in Firestore)
    textIv: iv, // Initialization vector for decryption
    text: '', // Keep empty for compatibility (or store "[Encrypted]")
    uid: user.uid,
    email: user.email?.toLowerCase() || '',
    displayName: user.displayName || 'Unknown',
    photoURL: user.photoURL || '',
    createdAt: serverTimestamp(),
  });

  // Update chat preview (sidebar) and increment unread count for other user
  const chatRef = doc(db, 'chats', chatId);

  try {
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) {
      const chatData = chatSnap.data();
      const otherParticipant = chatData.participants?.find(
        (p) => p.toLowerCase() !== user.email?.toLowerCase()
      );

      // ALWAYS use lowercase for unreadCount keys
      const otherParticipantLower = otherParticipant?.toLowerCase();

      // Initialize unreadCount if it doesn't exist (for legacy chats)
      const unreadCount = chatData.unreadCount || {};
      if (!chatData.unreadCount) {
        // Initialize counts for both participants (ALWAYS lowercase)
        chatData.participants.forEach(p => {
          unreadCount[p.toLowerCase()] = 0;
        });
      }

      // Build the updates object with proper nested structure for unreadCount
      const updates = {
        lastMessage: trimmed,
        lastSender: user.email?.toLowerCase() || '',
        updatedAt: serverTimestamp(),
      };

      // Increment unread count for the other user ONLY (ALWAYS lowercase)
      if (otherParticipantLower) {
        const currentCount = unreadCount[otherParticipantLower] || 0;
        updates.unreadCount = {
          ...unreadCount,
          [otherParticipantLower]: currentCount + 1,
        };
      }

      await updateDoc(chatRef, updates);
    }
  } catch (error) {
    console.error('Error updating chat metadata:', error);
    // Don't throw - message was already sent successfully
  }
}

/**
 * Send a media message (image or audio) in a specific chat
 * @param {Object} params
 * @param {string} params.chatId - The chat ID
 * @param {Object} params.user - User object with uid, email, displayName, photoURL
 * @param {string} params.mediaType - "image" | "audio"
 * @param {string} params.publicId - Cloudinary public ID
 * @param {string} params.resourceType - "image" | "video" | "raw"
 * @param {string} params.version - Cloudinary version number
 * @param {string} params.caption - Optional caption text
 */
export async function sendMediaMessage({
  chatId,
  user,
  mediaType,
  publicId,
  resourceType,
  version,
  caption = '',
}) {
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  const email = (user.email || '').toLowerCase();

  const payload = {
    type: mediaType, // "image" | "audio"
    text: '', // keep for compatibility
    caption: caption.trim(),
    media: {
      publicId,
      resourceType, // "image" | "video" | "raw"
      version, // Cloudinary version number
      // uploadType removed - using standard signed URLs with type="upload"
    },
    uid: user.uid,
    email,
    displayName: user.displayName || 'Unknown',
    photoURL: user.photoURL || '',
    createdAt: serverTimestamp(),
  };

  await addDoc(messagesRef, payload);

  // Update chat preview with media indicator (encrypted preview)
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);

  if (chatSnap.exists()) {
    const chatData = chatSnap.data();
    const otherParticipant = chatData.participants?.find(
      (p) => p.toLowerCase() !== user.email?.toLowerCase()
    );

    // ALWAYS use lowercase for unreadCount keys
    const otherParticipantLower = otherParticipant?.toLowerCase();

    const preview = mediaType === 'image' ? '📷 Photo' : '🎤 Voice message';
    const previewText = caption.trim() ? `${preview}: ${caption.trim()}` : preview;

    // Encrypt the preview text
    const chatKey = await getChatKey(chatId);
    const { ciphertext: encryptedPreview, iv: previewIv } = await encryptText(previewText, chatKey);

    // Initialize unreadCount if it doesn't exist (for legacy chats)
    const unreadCount = chatData.unreadCount || {};
    if (!chatData.unreadCount) {
      // Initialize counts for both participants (ALWAYS lowercase)
      chatData.participants.forEach(p => {
        unreadCount[p.toLowerCase()] = 0;
      });
    }

    const updates = {
      encryptedLastMessage: encryptedPreview,
      lastMessageIv: previewIv,
      lastMessage: preview, // Keep unencrypted icon for now (or set to '[Encrypted]')
      lastSender: email,
      updatedAt: serverTimestamp(),
    };

    // Increment unread count for the other user ONLY (ALWAYS lowercase)
    if (otherParticipantLower) {
      const currentCount = unreadCount[otherParticipantLower] || 0;
      updates.unreadCount = {
        ...unreadCount,
        [otherParticipantLower]: currentCount + 1,
      };
    }

    await updateDoc(chatRef, updates);
  }
}
