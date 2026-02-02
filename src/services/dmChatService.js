// src/services/dmChatService.js

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { buildDmChatId } from '../utils/chatId';

/**
 * Get an existing DM chat or create a new one
 * @param {Object} params
 * @param {string} params.myEmail - Current user's email
 * @param {string} params.otherEmail - Other user's email
 * @returns {Promise<{chatId: string}>} - The chat ID
 */
export async function getOrCreateDmChat({ myEmail, otherEmail }) {
  try {
    console.log('Creating chat between:', myEmail, 'and', otherEmail);

    const chatId = buildDmChatId(myEmail, otherEmail);
    const chatRef = doc(db, 'chats', chatId);

    console.log('Chat ID:', chatId);

    const snap = await getDoc(chatRef);

    if (!snap.exists()) {
      console.log('Chat does not exist, creating new chat...');
      const participantsSorted = [myEmail.toLowerCase(), otherEmail.toLowerCase()].sort();

      await setDoc(chatRef, {
        type: 'dm',
        participants: participantsSorted, // exactly 2
        participantsSorted: participantsSorted, // stable
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: '',
        lastSender: '',
        unreadCount: {
          [participantsSorted[0]]: 0,
          [participantsSorted[1]]: 0,
        },
      });
      console.log('Chat created successfully');
    } else {
      console.log('Chat already exists');
    }

    return { chatId };
  } catch (error) {
    console.error('Error in getOrCreateDmChat:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    throw error;
  }
}
