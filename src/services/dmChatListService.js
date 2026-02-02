// src/services/dmChatListService.js

import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Subscribe to all DM chats for the current user
 * @param {Object} params
 * @param {string} params.myEmail - Current user's email
 * @param {Function} params.onChats - Callback with chat list
 * @param {Function} params.onError - Error callback
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToMyDmChats({ myEmail, onChats, onError }) {
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', myEmail.toLowerCase()),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const chats = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      onChats(chats);
    },
    (error) => onError?.(error)
  );
}
