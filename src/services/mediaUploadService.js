// src/services/mediaUploadService.js
// Upload encrypted media files to Firebase Storage

import { ref, uploadBytes } from 'firebase/storage';
import { addDoc, collection, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { getChatKey } from '../crypto/chatKeyManager';
import { encryptFile } from '../crypto/mediaCrypto';

/**
 * Upload encrypted media (image or audio) to Firebase Storage
 * @param {Object} params
 * @param {File|Blob} params.file - File to upload
 * @param {string} params.chatId - Chat ID
 * @param {Object} params.user - User object (uid, email, displayName, photoURL)
 * @param {string} params.type - Media type: "image" | "audio"
 * @param {string} params.caption - Optional caption for images
 * @param {boolean} params.viewOnce - If true, image can only be viewed once
 * @returns {Promise<void>}
 */
export async function uploadMedia({ file, chatId, user, type, caption = '', viewOnce = false }) {
  // Validation
  if (type === 'image') {
    if (!file.type.startsWith('image/')) {
      throw new Error('Invalid file type. Please select an image.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image too large. Maximum size is 5MB.');
    }
  } else if (type === 'audio') {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Audio file too large. Maximum size is 5MB.');
    }
  }

  // Get the chat's encryption key (with user's email for key package lookup/sharing)
  const chatKey = await getChatKey(chatId, user.email);

  // Encrypt the file
  const { blob, iv } = await encryptFile(file, chatKey);

  // Generate a unique filename with .enc extension
  const fileName = `${crypto.randomUUID()}.enc`;
  const filePath = `chats/${chatId}/${fileName}`;

  // Upload encrypted blob to Firebase Storage
  const storageRef = ref(storage, filePath);
  await uploadBytes(storageRef, blob);

  // Save message metadata to Firestore
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  await addDoc(messagesRef, {
    type, // "image" | "audio"
    text: '', // Keep for compatibility
    caption: caption.trim(),
    viewOnce: viewOnce || false, // If true, can only be viewed once
    viewedBy: [], // Track who has viewed this (for view once)
    media: {
      filePath, // Path in Firebase Storage
      iv, // Initialization vector for decryption (base64)
      fileName, // Original encrypted filename
      mimeType: file.type || 'application/octet-stream', // Store original MIME type
    },
    uid: user.uid,
    email: user.email?.toLowerCase() || '',
    displayName: user.displayName || 'Unknown',
    photoURL: user.photoURL || '',
    createdAt: serverTimestamp(),
  });

  // Update chat preview (last message)
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);

  if (chatSnap.exists()) {
    const chatData = chatSnap.data();
    const otherParticipant = chatData.participants?.find(
      (p) => p.toLowerCase() !== user.email?.toLowerCase()
    );

    // ALWAYS use lowercase for unreadCount keys
    const otherParticipantLower = otherParticipant?.toLowerCase();

    const preview = type === 'image' ? '📷 Photo' : '🎤 Voice message';
    const lastMessage = caption.trim() ? `${preview}: ${caption.trim()}` : preview;

    const updates = {
      lastMessage,
      lastSender: user.email?.toLowerCase() || '',
      updatedAt: serverTimestamp(),
    };

    // Increment unread count for the other user (ALWAYS lowercase)
    if (otherParticipantLower) {
      const currentCount = chatData.unreadCount?.[otherParticipantLower] || 0;
      updates.unreadCount = {
        ...chatData.unreadCount,
        [otherParticipantLower]: currentCount + 1,
      };
    }

    await updateDoc(chatRef, updates);
  }
}
