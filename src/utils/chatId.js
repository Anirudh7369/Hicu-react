// src/utils/chatId.js

/**
 * Generate a deterministic chat ID for two users
 * This ensures the same two people always get the same chat ID
 * @param {string} emailA - First user's email
 * @param {string} emailB - Second user's email
 * @returns {string} - Deterministic chat ID
 */
export function buildDmChatId(emailA, emailB) {
  const [first, second] = [emailA.trim().toLowerCase(), emailB.trim().toLowerCase()].sort();

  // Replace characters to keep the doc id clean
  const safe = (s) => s.replaceAll('.', '_').replaceAll('@', '__at__');

  return `${safe(first)}__${safe(second)}`;
}
