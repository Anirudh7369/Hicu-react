// src/services/mediaDownloadService.js
// Download and decrypt media files from Firebase Storage

import { ref, getBlob } from 'firebase/storage';
import { storage } from '../firebase';
import { getChatKey } from '../crypto/chatKeyManager';
import { decryptFile } from '../crypto/mediaCrypto';
import { getCachedMedia, cacheMedia } from './mediaCacheService';

/**
 * Infer MIME type from file path/extension
 * @param {string} filePath - File path
 * @returns {string} - MIME type
 */
function inferMimeType(filePath) {
  const extension = filePath.split('.').pop()?.toLowerCase();

  const mimeTypes = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',

    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    webm: 'audio/webm',

    // Video (future support)
    mp4: 'video/mp4',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Get file extension from MIME type
 * @param {string} mimeType - MIME type
 * @returns {string} - File extension
 */
function getExtensionFromMimeType(mimeType) {
  const extensionMap = {
    // Images
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',

    // Audio
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/webm': 'webm',

    // Video
    'video/mp4': 'mp4',
    'video/x-msvideo': 'avi',
    'video/quicktime': 'mov',
  };

  return extensionMap[mimeType] || mimeType.split('/')[1]?.split(';')[0] || 'bin';
}

/**
 * Get decrypted media URL for display (with caching)
 * @param {Object} params
 * @param {string} params.chatId - Chat ID
 * @param {Object} params.message - Message object containing media metadata
 * @param {string} params.userEmail - Current user's email (for key package lookup)
 * @returns {Promise<{blobUrl: string, mimeType: string}>} - Blob URL and MIME type
 */
export async function getDecryptedMediaUrl({ chatId, message, userEmail }) {
  // Check cache first
  const cached = getCachedMedia(message.id);
  if (cached) {
    return cached;
  }

  // Check for old Cloudinary format (legacy messages)
  if (message.media?.publicId) {
    throw new Error('Legacy Cloudinary message format not supported. Please re-send this image.');
  }

  if (!message.media?.filePath || !message.media?.iv) {
    throw new Error('Invalid message: missing media metadata');
  }

  // Get the chat's encryption key (with user's email for key package lookup)
  const chatKey = await getChatKey(chatId, userEmail);

  // Download encrypted file from Firebase Storage
  const storageRef = ref(storage, message.media.filePath);

  let decryptedBlob;

  try {
    // Try using getBlob first (secure, authenticated method)
    const encryptedBlob = await getBlob(storageRef);

    // Decrypt the file
    decryptedBlob = await decryptFile(encryptedBlob, chatKey, message.media.iv);
  } catch (error) {
    // Catch any error (CORS, unauthorized, network issues)
    console.warn('getBlob failed, trying download URL approach...', error.code || error.message);

    try {
      // Import getDownloadURL dynamically as fallback
      const { getDownloadURL } = await import('firebase/storage');
      const downloadUrl = await getDownloadURL(storageRef);

      // Fetch the encrypted file
      const response = await fetch(downloadUrl, { mode: 'cors' });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const encryptedBlob = await response.blob();

      // Decrypt the file
      decryptedBlob = await decryptFile(encryptedBlob, chatKey, message.media.iv);
    } catch (fallbackError) {
      console.error('Both getBlob and fetch failed:', fallbackError);
      throw new Error('Failed to download media. Please check your connection and try again.');
    }
  }

  // Get MIME type from message metadata (preferred) or infer from file path (fallback)
  const mimeType = message.media.mimeType || inferMimeType(message.media.filePath);

  // Create new blob with correct MIME type
  const typedBlob = new Blob([decryptedBlob], { type: mimeType });
  const blobUrl = URL.createObjectURL(typedBlob);

  cacheMedia(message.id, blobUrl, mimeType);

  return { blobUrl, mimeType };
}

/**
 * Revoke a blob URL to free memory
 * @param {string} blobUrl - Blob URL to revoke
 */
export function revokeBlobUrl(blobUrl) {
  if (blobUrl && blobUrl.startsWith('blob:')) {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Download decrypted media file to user's device
 * @param {Object} params
 * @param {string} params.chatId - Chat ID
 * @param {Object} params.message - Message object
 * @param {string} params.filename - Desired filename
 * @param {string} params.userEmail - Current user's email (for key package lookup)
 */
export async function downloadDecryptedMedia({ chatId, message, filename, userEmail }) {
  try {
    // Get decrypted media (from cache or decrypt)
    const { blobUrl, mimeType } = await getDecryptedMediaUrl({ chatId, message, userEmail });

    // Fetch the blob from the blob URL
    const response = await fetch(blobUrl);
    const blob = await response.blob();

    // Get proper file extension from MIME type
    const extension = getExtensionFromMimeType(mimeType);

    const finalFilename = filename || `media_${message.id}.${extension}`;

    // Create download link
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = finalFilename;

    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Clean up the temporary blob URL
    URL.revokeObjectURL(downloadLink.href);

    console.log('✅ Downloaded decrypted media:', finalFilename);
  } catch (error) {
    console.error('Failed to download media:', error);
    throw error;
  }
}
