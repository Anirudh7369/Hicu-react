// Debug utility for Storage permission issues
// Run this in browser console: window.debugStorage()

import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function debugStoragePermissions(chatId) {
  console.log('🔍 Debugging Storage Permissions...\n');

  try {
    // 1. Check current user
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No user signed in!');
      return;
    }
    console.log('✅ User signed in:', user.email);
    console.log('   Lowercase:', user.email.toLowerCase());

    // 2. Check allowlist
    const allowlistRef = doc(db, 'allowed_emails', user.email.toLowerCase());
    const allowlistSnap = await getDoc(allowlistRef);
    console.log('\n📋 Allowlist check:');
    console.log('   Document path:', `allowed_emails/${user.email.toLowerCase()}`);
    console.log('   Exists:', allowlistSnap.exists() ? '✅' : '❌');

    // 3. Check chat data
    if (!chatId) {
      console.warn('⚠️  No chatId provided. Get it from ChatInterfacePage props.');
      return;
    }

    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      console.error('❌ Chat document does not exist!');
      return;
    }

    const chatData = chatSnap.data();
    console.log('\n💬 Chat data:');
    console.log('   Chat ID:', chatId);
    console.log('   Participants:', chatData.participants);
    console.log('   Encryption key exists:', chatData.encryptionKey ? '✅' : '❌');

    // 4. Check if user is participant
    const userEmail = user.email.toLowerCase();
    const isParticipant = chatData.participants?.some(
      (p) => p.toLowerCase() === userEmail
    );
    console.log('\n👥 Participant check:');
    console.log('   Is participant:', isParticipant ? '✅' : '❌');

    // 5. Expected Storage path
    const expectedPath = `chats/${chatId}/{randomId}.enc`;
    console.log('\n📁 Expected Storage path:');
    console.log('   ', expectedPath);

    // 6. Summary
    console.log('\n📊 Summary:');
    const allChecks = allowlistSnap.exists() && chatSnap.exists() && isParticipant;
    if (allChecks) {
      console.log('✅ All checks passed! Storage rules should allow upload.');
      console.log('   If still failing, check if Storage rules are DEPLOYED in Firebase Console.');
    } else {
      console.log('❌ Some checks failed:');
      if (!allowlistSnap.exists()) {
        console.log('   - User not in allowlist');
      }
      if (!chatSnap.exists()) {
        console.log('   - Chat does not exist');
      }
      if (!isParticipant) {
        console.log('   - User not in participants array');
      }
    }
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  window.debugStorage = debugStoragePermissions;
}
