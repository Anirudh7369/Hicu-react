// public/firebase-messaging-sw.js
// Service Worker for handling Firebase Cloud Messaging background notifications

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.7.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
// Note: Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDwckVcytDD1wRd1245AR9Wfu33HYnkTtc",
  authDomain: "hicu-eb71e.firebaseapp.com",
  projectId: "hicu-eb71e",
  storageBucket: "hicu-eb71e.firebasestorage.app",
  messagingSenderId: "331484287284",
  appId: "1:331484287284:web:86eab5e85edc15e7e25561"
};

// Initialize Firebase app
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages (when app is closed or in background)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  // Customize notification
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'hicu-message',
    requireInteraction: false,
    data: payload.data || {}
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  event.notification.close();

  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Focus existing window
          return client.focus();
        }
      }

      // Open new window if app is not open
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
