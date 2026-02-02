# Push Notifications Setup Guide

This guide will help you set up privacy-preserving push notifications that alert users of new messages without revealing content.

## Overview

The notification system:
- ✅ Alerts users when they receive a new message
- ✅ Does NOT reveal message content (privacy-first)
- ✅ Works even when app is closed (background notifications)
- ✅ Supports both mobile and desktop browsers

---

## Step 1: Get VAPID Keys from Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click ⚙️ **Settings** > **Project Settings**
4. Go to **Cloud Messaging** tab
5. Scroll to **Web Push certificates** section
6. If you don't have a key pair, click **Generate key pair**
7. Copy the **Key pair** value (starts with `B...`)

---

## Step 2: Update Your Code with VAPID Key

### File: `src/services/notificationService.js`

Find this line (around line 48):
```javascript
vapidKey: 'YOUR_VAPID_KEY_HERE' // Replace with your actual VAPID key
```

Replace with your actual VAPID key:
```javascript
vapidKey: 'BFxT8u...' // Your key from Step 1
```

---

## Step 3: Update Firebase Messaging Service Worker

### File: `public/firebase-messaging-sw.js`

Find the Firebase config (lines 9-15) and replace with YOUR Firebase config:

```javascript
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.storageBucket.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});
```

Get this config from:
Firebase Console > Project Settings > General > Your apps > Web app > SDK setup and configuration

---

## Step 4: Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

This deploys the new rules that allow users to store their FCM tokens.

---

## Step 5: Set Up Cloud Function to Send Notifications

You need a Cloud Function that triggers when a new message is created and sends a notification to the recipient.

### Option A: Use Firebase Extensions (Easier - Recommended)

Unfortunately, there's no pre-built extension for this exact use case. Skip to Option B.

### Option B: Write Custom Cloud Function (Required)

#### 1. Initialize Cloud Functions

```bash
cd /path/to/your/project
firebase init functions
# Choose JavaScript or TypeScript
# Install dependencies
```

#### 2. Install Firebase Admin SDK

```bash
cd functions
npm install firebase-admin
```

#### 3. Create Notification Function

Create `functions/index.js`:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Trigger when new message is created
exports.sendMessageNotification = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();
    const chatId = context.params.chatId;

    try {
      // Get chat document to find recipient
      const chatDoc = await admin.firestore()
        .collection('chats')
        .doc(chatId)
        .get();

      if (!chatDoc.exists) {
        console.log('Chat not found');
        return null;
      }

      const chatData = chatDoc.data();
      const participants = chatData.participants || [];

      // Find recipient (not the sender)
      const senderEmail = message.email;
      const recipientEmail = participants.find(
        email => email.toLowerCase() !== senderEmail.toLowerCase()
      );

      if (!recipientEmail) {
        console.log('No recipient found');
        return null;
      }

      // Get recipient's FCM token
      const tokenDoc = await admin.firestore()
        .collection('fcmTokens')
        .doc(recipientEmail.toLowerCase())
        .get();

      if (!tokenDoc.exists) {
        console.log('Recipient has no FCM token');
        return null;
      }

      const fcmToken = tokenDoc.data().token;

      // Prepare notification
      const payload = {
        notification: {
          title: 'New Message',
          body: 'You have a new message on Hicu',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'hicu-message'
        },
        data: {
          chatId: chatId,
          click_action: '/' // Open app on click
        },
        token: fcmToken
      };

      // Send notification
      await admin.messaging().send(payload);
      console.log('Notification sent successfully');

      return null;
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  });
```

#### 4. Deploy Cloud Function

```bash
firebase deploy --only functions
```

---

## Step 6: Test Notifications

### Testing on Desktop

1. Open your app in Chrome/Firefox
2. Sign in
3. Click **Enable** when notification prompt appears
4. Open DevTools > Application > Service Workers
   - Verify `firebase-messaging-sw.js` is registered
5. Have another user send you a message
6. You should see a notification!

### Testing on Mobile

1. Open app in mobile browser (Chrome/Safari)
2. Sign in
3. Enable notifications when prompted
4. Close the app or switch to another app
5. Have someone send you a message
6. Notification should appear!

### Debugging

**Check browser console for:**
- `FCM Token obtained: ...` - Token was received
- `FCM token saved to Firestore` - Token was stored
- `Notification permission: granted` - User gave permission

**Check Firebase Console:**
1. Firestore > `fcmTokens` collection - Should have entries
2. Functions > Logs - Should see function executions

---

## Step 7: Handle Notification Clicks (Optional)

Users clicking notifications should open the chat. Update `public/firebase-messaging-sw.js`:

```javascript
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const chatId = event.notification.data?.chatId;
  const url = chatId ? `/?chat=${chatId}` : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if app is open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window with chat
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
```

---

## Privacy & Security Notes

### What's Sent in Notifications

✅ **Generic notification**: "You have a new message"
✅ **No message content**
✅ **No sender name**
✅ **Just an alert that a message arrived**

### Why This Is Private

- Message content stays encrypted end-to-end
- Notification server (Firebase) never sees plaintext
- Only the generic alert is sent via FCM
- User must open app to decrypt and read message

---

## Troubleshooting

### Notification Permission Denied

If user denies permission, they need to:
1. Click lock icon in address bar
2. Reset notification permission
3. Reload app and enable when prompted

### Notifications Not Appearing

**Check:**
1. FCM token is saved in Firestore (`fcmTokens/{email}`)
2. Cloud Function is deployed and running
3. Browser notification permission is granted
4. Service worker is registered (`firebase-messaging-sw.js`)
5. VAPID key is correct in `notificationService.js`

**Common Issues:**
- VAPID key is wrong → Check Firebase Console
- Cloud Function not deployed → Run `firebase deploy --only functions`
- Browser doesn't support notifications → Use Chrome/Firefox/Safari
- Service worker not registered → Check DevTools > Application

---

## Cost Estimate

### Firebase Cloud Messaging (FCM)

- **Free tier**: Unlimited notifications
- **No cost** for basic usage

### Cloud Functions

- **Free tier**:
  - 2 million invocations/month
  - 400,000 GB-seconds of compute time
  - 200,000 GB-seconds of memory time

For a small app (< 100 users, < 1000 messages/day):
- **Cost**: $0/month (stays in free tier)

For larger scale:
- ~$0.40 per million invocations after free tier
- Very affordable for most use cases

---

## Alternative: Client-Side Notifications (No Cloud Function Needed)

If you don't want to use Cloud Functions, you can use Firestore triggers on the client:

### Pros:
- No Cloud Function needed
- No server costs
- Simpler setup

### Cons:
- Only works when app is open in background
- No notifications when app is completely closed
- Drains battery on mobile

This approach is already implemented in `src/services/notificationService.js` via `onForegroundMessage()`.

---

## Summary

1. ✅ Get VAPID key from Firebase Console
2. ✅ Update `notificationService.js` with VAPID key
3. ✅ Update `firebase-messaging-sw.js` with Firebase config
4. ✅ Deploy Firestore rules
5. ✅ Set up Cloud Function to send notifications
6. ✅ Test on desktop and mobile
7. ✅ Enjoy privacy-preserving notifications!

Your users will now get notified of new messages without compromising their privacy! 🔔🔒
