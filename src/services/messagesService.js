// src/services/messagesService.js

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";

// 1) Reference to /messages collection
const messagesCollectionRef = collection(db, "messages");

// SEND MESSAGE (publish)
export async function sendMessage({ text, user }) {
  const trimmedText = text.trim();
  if (!trimmedText) return;

  await addDoc(messagesCollectionRef, {
    text: trimmedText,
    uid: user.uid,
    displayName: user.displayName || "Unknown",
    photoURL: user.photoURL || "",
    createdAt: serverTimestamp(),
  });
}

// SUBSCRIBE TO MESSAGES (subscribe)
export function subscribeToMessages({ onMessages, messagesLimit = 100 }) {
  const messagesQuery = query(
    messagesCollectionRef,
    orderBy("createdAt", "asc"),
    limit(messagesLimit)
  );

  // Real-time listener
  const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map((doc) => {
      return {
        id: doc.id,
        ...doc.data(),
      };
    });

    onMessages(messages);
  });

  return unsubscribe;
}
