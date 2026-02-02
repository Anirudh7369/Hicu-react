// src/services/readReceiptService.js
// Service for managing read receipts

import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Mark a message as read by the current user
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {string} userEmail - Current user's email
 * @returns {Promise<void>}
 */
export async function markMessageAsRead(chatId, messageId, userEmail) {
  try {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);

    await updateDoc(messageRef, {
      readBy: arrayUnion(userEmail.toLowerCase()),
    });
  } catch (error) {
    // Silently fail - read receipts are not critical
    console.warn('Failed to mark message as read:', error);
  }
}

/**
 * Mark multiple messages as read
 * @param {string} chatId - Chat ID
 * @param {Array<Object>} messages - Array of message objects
 * @param {string} userEmail - Current user's email
 * @returns {Promise<void>}
 */
export async function markMessagesAsRead(chatId, messages, userEmail) {
  const unreadMessages = messages.filter(
    (msg) =>
      msg.email?.toLowerCase() !== userEmail.toLowerCase() && // Not sent by me
      !msg.readBy?.includes(userEmail.toLowerCase()) // Not already read by me
  );

  for (const message of unreadMessages) {
    try {
      await markMessageAsRead(chatId, message.id, userEmail);
    } catch (error) {
      // Continue marking other messages even if one fails
      console.warn(`Failed to mark message ${message.id} as read:`, error);
    }
  }
}

/**
 * Check if a message has been read by the recipient
 * @param {Object} message - Message object
 * @param {string} senderEmail - Sender's email
 * @returns {boolean} - True if message has been read by recipient
 */
export function isMessageRead(message, senderEmail) {
  if (!message.readBy || message.readBy.length === 0) {
    return false;
  }

  // Check if anyone other than the sender has read it
  return message.readBy.some(
    (email) => email.toLowerCase() !== senderEmail.toLowerCase()
  );
}

/**
 * Reset unread count for the current user when they open a chat
 * @param {string} chatId - Chat ID
 * @param {string} userEmail - Current user's email
 * @returns {Promise<void>}
 */
export async function resetUnreadCount(chatId, userEmail) {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      return;
    }

    const chatData = chatSnap.data();
    const normalizedEmail = userEmail.toLowerCase();

    // Get current unreadCount or create empty object
    const currentUnreadCount = chatData.unreadCount || {};

    // Check if unreadCount field exists
    if (!chatData.unreadCount) {
      // Initialize unreadCount for all participants
      const unreadCount = {};
      chatData.participants?.forEach((email) => {
        unreadCount[email.toLowerCase()] = 0;
      });
      await updateDoc(chatRef, { unreadCount });
      return;
    }

    // Get user's current count
    const userCount = currentUnreadCount[normalizedEmail];

    if (userCount === undefined) {
      // Create updated object with user added
      const updatedUnreadCount = {
        ...currentUnreadCount,
        [normalizedEmail]: 0
      };
      await updateDoc(chatRef, { unreadCount: updatedUnreadCount });
      return;
    }

    // Only update if there's actually an unread count to reset
    if (userCount > 0) {
      // Create updated object with user's count reset
      const updatedUnreadCount = {
        ...currentUnreadCount,
        [normalizedEmail]: 0
      };
      await updateDoc(chatRef, { unreadCount: updatedUnreadCount });
    }
  } catch (error) {
    console.error('Failed to reset unread count:', error);
  }
}
