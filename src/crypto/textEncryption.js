// src/crypto/textEncryption.js
// Encrypt and decrypt text messages

/**
 * Encrypt text message
 * @param {string} text - Plaintext message
 * @param {CryptoKey} key - AES-GCM key
 * @returns {Promise<{ciphertext: string, iv: string}>} - Encrypted message and IV (both base64)
 */
export async function encryptText(text, key) {
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Convert text to bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Convert to base64 for Firestore storage
  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return {
    ciphertext,
    iv: ivBase64,
  };
}

/**
 * Decrypt text message
 * @param {string} ciphertext - Base64-encoded encrypted text
 * @param {string} ivBase64 - Base64-encoded IV
 * @param {CryptoKey} key - AES-GCM key
 * @returns {Promise<string>} - Decrypted plaintext
 */
export async function decryptText(ciphertext, ivBase64, key) {
  // Convert from base64
  const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Convert bytes to text
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
