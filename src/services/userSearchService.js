// src/services/userSearchService.js

import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Search for users by display name or email
 * @param {string} searchQuery - Search term
 * @param {string} currentUserEmail - Current user's email (to exclude from results)
 * @returns {Promise<Array>} - Array of user profiles
 */
export async function searchUsers(searchQuery, currentUserEmail) {
  if (!searchQuery || searchQuery.length < 2) return [];

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, limit(50));
    const snapshot = await getDocs(q);

    const users = snapshot.docs.map((doc) => ({
      email: doc.id,
      ...doc.data(),
    }));

    // Filter by search query (client-side)
    const searchLower = searchQuery.toLowerCase();
    const filtered = users.filter((user) => {
      // Exclude current user
      if (user.email.toLowerCase() === currentUserEmail?.toLowerCase()) {
        return false;
      }

      // Search in display name and email
      return (
        user.displayName?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      );
    });

    return filtered;
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}
