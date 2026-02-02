// src/services/notificationService.js
// Service for managing push notifications with Firebase Cloud Messaging

import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

let messaging = null;

// Initialize Firebase Cloud Messaging
export function initializeMessaging() {
  try {
    messaging = getMessaging();
    return messaging;
  } catch (error) {
    console.error('Error initializing messaging:', error);
    return null;
  }
}

/**
 * Request notification permission and get FCM token
 * @param {string} userEmail - Current user's email
 * @returns {Promise<string|null>} FCM token or null if denied
 */
export async function requestNotificationPermission(userEmail) {
  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Initialize messaging if not already done
    if (!messaging) {
      messaging = initializeMessaging();
    }

    if (!messaging) {
      return null;
    }

    // Get FCM token
    // Note: You need to add your VAPID key from Firebase Console
    // Go to Project Settings > Cloud Messaging > Web Push certificates
    const token = await getToken(messaging, {
      vapidKey: 'BD1Hxy8r4Dr0DlWgktl6I45EvYuIvogyulJ9jevQ9fYt0i6yUmWJh4Xqt56vtB292YyOweO33BddVdv8HS4_i4A' // Replace with your actual VAPID key
    });

    if (token) {
      console.log('FCM Token obtained:', token);

      // Save token to Firestore
      await saveFCMToken(userEmail, token);

      return token;
    } else {
      console.log('No registration token available');
      return null;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
}

/**
 * Save FCM token to Firestore
 * @param {string} userEmail - User's email
 * @param {string} token - FCM token
 */
async function saveFCMToken(userEmail, token) {
  try {
    const tokenRef = doc(db, 'fcmTokens', userEmail.toLowerCase());
    await setDoc(tokenRef, {
      token,
      updatedAt: new Date(),
      platform: navigator.userAgent
    });
    console.log('FCM token saved to Firestore');
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
}

/**
 * Get FCM token for a user
 * @param {string} userEmail - User's email
 * @returns {Promise<string|null>} FCM token or null
 */
export async function getUserFCMToken(userEmail) {
  try {
    const tokenRef = doc(db, 'fcmTokens', userEmail.toLowerCase());
    const tokenDoc = await getDoc(tokenRef);

    if (tokenDoc.exists()) {
      return tokenDoc.data().token;
    }

    return null;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

/**
 * Delete FCM token (when user logs out)
 * @param {string} userEmail - User's email
 */
export async function deleteFCMToken(userEmail) {
  try {
    const tokenRef = doc(db, 'fcmTokens', userEmail.toLowerCase());
    await deleteDoc(tokenRef);
    console.log('FCM token deleted');
  } catch (error) {
    console.error('Error deleting FCM token:', error);
  }
}

/**
 * Listen for foreground messages (when app is open)
 * @param {Function} callback - Called when message received
 */
export function onForegroundMessage(callback) {
  if (!messaging) {
    messaging = initializeMessaging();
  }

  if (!messaging) {
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);

    // Show notification even when app is in foreground
    if (payload.notification) {
      const { title, body, icon } = payload.notification;

      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
          body,
          icon: icon || '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'hicu-message',
          requireInteraction: false
        });

        notification.onclick = () => {
          window.focus();
          notification.close();

          // Navigate to chat if data is provided
          if (payload.data?.chatId) {
            callback?.(payload.data);
          }
        };
      }
    }

    callback?.(payload);
  });
}

/**
 * Check if notifications are enabled
 * @returns {boolean}
 */
export function areNotificationsEnabled() {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Get notification permission status
 * @returns {NotificationPermission}
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}
