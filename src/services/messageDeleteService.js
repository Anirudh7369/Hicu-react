// src/services/messageDeleteService.js
// Service for unsending messages (deletes from both sides)

import { doc, deleteDoc, collection, query, orderBy, limit, getDocs, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

/**
 * Unsend a message (delete from Firestore and Storage if it has media)
 * @param {string} chatId - Chat ID
 * @param {Object} message - Message object to delete
 * @returns {Promise<void>}
 */
export async function unsendMessage(chatId, message) {
  try {
    // Delete media from storage if exists
    if (message.media?.filePath) {
      try {
        const storageRef = ref(storage, message.media.filePath);
        await deleteObject(storageRef);
      } catch (storageError) {
        console.warn('Storage deletion warning:', storageError);
        // Continue even if storage deletion fails
      }
    }

    // Delete message from Firestore
    const messageRef = doc(db, 'chats', chatId, 'messages', message.id);
    await deleteDoc(messageRef);

    // Update the chat's lastMessage to the new most recent message
    await updateChatLastMessage(chatId);
  } catch (error) {
    console.error('Error unsending message:', error);
    throw error;
  }
}

/**
 * Update the chat's lastMessage field after a message is deleted
 * @param {string} chatId - Chat ID
 * @returns {Promise<void>}
 */
async function updateChatLastMessage(chatId) {
  try {
    // Get the most recent message
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(1));
    const snapshot = await getDocs(q);

    const chatRef = doc(db, 'chats', chatId);

    if (snapshot.empty) {
      // No messages left - clear lastMessage
      await updateDoc(chatRef, {
        lastMessage: '',
        lastSender: '',
      });
    } else {
      // Update with the new last message
      const lastMsg = snapshot.docs[0].data();
      let lastMessageText = '';

      if (lastMsg.type === 'image') {
        lastMessageText = lastMsg.caption ? `📷 Photo: ${lastMsg.caption}` : '📷 Photo';
      } else if (lastMsg.type === 'audio') {
        lastMessageText = '🎤 Voice message';
      } else {
        lastMessageText = lastMsg.text || '';
      }

      await updateDoc(chatRef, {
        lastMessage: lastMessageText,
        lastSender: lastMsg.email || '',
      });
    }
  } catch (error) {
    console.error('Error updating lastMessage:', error);
    // Don't throw - message was already deleted successfully
  }
}
