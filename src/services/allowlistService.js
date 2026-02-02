// src/services/allowlistService.js

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Check if a user's email is in the allowed_emails collection
 * @param {string} email - User's email address
 * @returns {Promise<boolean>} - True if email is allowed, false otherwise
 */
export async function isUserAllowed(email) {
  if (!email) return false;

  try {
    const allowedRef = doc(db, "allowed_emails", email);
    const snap = await getDoc(allowedRef);
    return snap.exists();
  } catch (error) {
    console.error("Error checking allowlist:", error);
    return false;
  }
}
