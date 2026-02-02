// src/services/userProfileService.js

import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

/**
 * Create or update user profile in Firestore
 * @param {Object} user - Firebase Auth user object
 */
export async function updateUserProfile(user) {
  if (!user?.email) return;

  try {
    const userRef = doc(db, 'users', user.email.toLowerCase());

    // Get existing profile to preserve custom photoURL
    const existingProfile = await getDoc(userRef);
    const existingData = existingProfile.exists() ? existingProfile.data() : {};

    // Only use Auth photoURL if there's no existing custom photoURL
    // A custom photoURL from Storage will contain 'firebasestorage.googleapis.com'
    const hasCustomPhoto = existingData.photoURL &&
                          existingData.photoURL.includes('firebasestorage.googleapis.com');

    await setDoc(
      userRef,
      {
        email: user.email.toLowerCase(),
        displayName: user.displayName || user.email.split('@')[0],
        photoURL: hasCustomPhoto ? existingData.photoURL : (user.photoURL || ''),
        lastSeen: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error updating user profile:', error);
  }
}

/**
 * Get user profile by email
 * @param {string} email - User's email
 * @returns {Promise<Object|null>} - User profile or null
 */
export async function getUserProfile(email) {
  if (!email) return null;

  try {
    const userRef = doc(db, 'users', email.toLowerCase());
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      return snap.data();
    }

    // Fallback: return email as display name
    return {
      email: email.toLowerCase(),
      displayName: email.split('@')[0],
      photoURL: '',
    };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return {
      email: email.toLowerCase(),
      displayName: email.split('@')[0],
      photoURL: '',
    };
  }
}

/**
 * Upload profile picture to Firebase Storage
 * @param {File} file - Image file
 * @param {string} userEmail - User's email
 * @returns {Promise<string>} - Download URL of uploaded image
 */
export async function uploadProfilePicture(file, userEmail) {
  if (!file || !userEmail) {
    throw new Error('File and user email are required');
  }

  try {
    // Create a reference to the file location
    const fileExtension = file.name.split('.').pop();
    const fileName = `${userEmail.toLowerCase()}_${Date.now()}.${fileExtension}`;
    const storageRef = ref(storage, `profile-pictures/${fileName}`);

    // Upload the file
    await uploadBytes(storageRef, file);

    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    throw error;
  }
}

/**
 * Update user profile with custom fields
 * @param {string} userEmail - User's email
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<void>}
 */
export async function updateUserProfileData(userEmail, profileData) {
  if (!userEmail) {
    throw new Error('User email is required');
  }

  try {
    const userRef = doc(db, 'users', userEmail.toLowerCase());

    await setDoc(
      userRef,
      {
        ...profileData,
        email: userEmail.toLowerCase(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    console.log('✅ Profile updated successfully');
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}
