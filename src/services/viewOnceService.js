// src/services/viewOnceService.js
// Service for handling view once media

import { doc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

/**
 * Mark a view once message as viewed by the current user
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {string} userEmail - Current user's email
 * @returns {Promise<void>}
 */
export async function markAsViewed(chatId, messageId, userEmail) {
  try {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);

    await updateDoc(messageRef, {
      viewedBy: arrayUnion(userEmail.toLowerCase()),
    });

    console.log('✅ Message marked as viewed');
  } catch (error) {
    console.error('Error marking message as viewed:', error);
    throw error;
  }
}

/**
 * Delete a view once message and its media from storage
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {string} filePath - Path to file in storage
 * @returns {Promise<void>}
 */
export async function deleteViewOnceMessage(chatId, messageId, filePath) {
  try {
    // Delete from Firebase Storage
    if (filePath) {
      const storageRef = ref(storage, filePath);
      try {
        await deleteObject(storageRef);
        console.log('✅ Media file deleted from storage');
      } catch (storageError) {
        // File might already be deleted, continue anyway
        console.warn('Storage deletion warning:', storageError);
      }
    }

    // Delete message from Firestore
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await deleteDoc(messageRef);

    console.log('✅ View once message deleted');
  } catch (error) {
    console.error('Error deleting view once message:', error);
    throw error;
  }
}

/**
 * Check if current user has viewed this message
 * @param {Object} message - Message object
 * @param {string} userEmail - Current user's email
 * @returns {boolean}
 */
export function hasUserViewed(message, userEmail) {
  if (!message.viewOnce) return false;
  const viewedBy = message.viewedBy || [];
  return viewedBy.includes(userEmail.toLowerCase());
}
