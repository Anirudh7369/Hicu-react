const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const {info, error: logError} = require('firebase-functions/logger');

// Initialize Firebase Admin
admin.initializeApp();

/**
 * Cloud Function: Send push notification when new message is created
 * Triggers on: /chats/{chatId}/messages/{messageId} onCreate
 *
 * Privacy-preserving: Does NOT include message content in notification
 */
exports.sendMessageNotification = onDocumentCreated(
  'chats/{chatId}/messages/{messageId}',
  async (event) => {
    const message = event.data.data();
    const chatId = event.params.chatId;

    try {
      info(`New message in chat ${chatId}, processing notification...`);

      // Get chat document to find recipient
      const chatDoc = await admin.firestore()
        .collection('chats')
        .doc(chatId)
        .get();

      if (!chatDoc.exists) {
        info('Chat not found, skipping notification');
        return null;
      }

      const chatData = chatDoc.data();
      const participants = chatData.participants || [];

      // Find recipient (not the sender)
      const senderEmail = message.email?.toLowerCase() || '';
      const recipientEmail = participants.find(
        (email) => email.toLowerCase() !== senderEmail
      );

      if (!recipientEmail) {
        info('No recipient found, skipping notification');
        return null;
      }

      info(`Recipient: ${recipientEmail}`);

      // Get recipient's FCM token
      const tokenDoc = await admin.firestore()
        .collection('fcmTokens')
        .doc(recipientEmail.toLowerCase())
        .get();

      if (!tokenDoc.exists) {
        info('Recipient has no FCM token (notifications not enabled)');
        return null;
      }

      const fcmToken = tokenDoc.data().token;

      if (!fcmToken) {
        info('FCM token is empty');
        return null;
      }

      info('Sending notification...');

      // Prepare privacy-preserving notification
      // NOTE: We do NOT include message content for privacy!
      const payload = {
        notification: {
          title: 'New Message',
          body: 'You have a new message on Hicu',
        },
        data: {
          chatId: chatId,
          type: 'new_message',
        },
        token: fcmToken,
        // Android-specific options
        android: {
          priority: 'high',
          notification: {
            icon: '/icon-192.png',
            color: '#A076F9',
            sound: 'default',
            tag: 'hicu-message', // Replace previous notifications
          },
        },
        // Apple-specific options
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        // Web-specific options
        webpush: {
          notification: {
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'hicu-message',
            requireInteraction: false,
          },
          fcmOptions: {
            link: 'https://hicu-eb71e.web.app',
          },
        },
      };

      // Send notification
      await admin.messaging().send(payload);
      info('✅ Notification sent successfully');

      return null;
    } catch (err) {
      logError('❌ Error sending notification:', err);

      // If token is invalid, delete it from Firestore
      if (err.code === 'messaging/invalid-registration-token' ||
          err.code === 'messaging/registration-token-not-registered') {
        info('Invalid token, deleting from Firestore...');
        try {
          const recipientEmail = participants.find(
            (email) => email.toLowerCase() !== message.email?.toLowerCase()
          );
          if (recipientEmail) {
            await admin.firestore()
              .collection('fcmTokens')
              .doc(recipientEmail.toLowerCase())
              .delete();
            info('Deleted invalid token');
          }
        } catch (deleteError) {
          logError('Error deleting invalid token:', deleteError);
        }
      }

      return null;
    }
  }
);
