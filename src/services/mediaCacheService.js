// src/services/mediaCacheService.js
// Cache decrypted media blob URLs to prevent re-decryption

/**
 * In-memory cache for decrypted media blob URLs
 * Key: messageId, Value: { blobUrl, mimeType, timestamp }
 */
const mediaCache = new Map();

/**
 * Maximum cache size (number of media items to keep in memory)
 * Adjust based on your needs
 */
const MAX_CACHE_SIZE = 100;

/**
 * Get decrypted media from cache
 * @param {string} messageId - Message ID
 * @returns {{ blobUrl: string, mimeType: string } | null}
 */
export function getCachedMedia(messageId) {
  const cached = mediaCache.get(messageId);
  if (cached) {
    console.log('📦 Cache HIT for message:', messageId);
    return {
      blobUrl: cached.blobUrl,
      mimeType: cached.mimeType,
    };
  }
  console.log('📦 Cache MISS for message:', messageId);
  return null;
}

/**
 * Store decrypted media in cache
 * @param {string} messageId - Message ID
 * @param {string} blobUrl - Decrypted blob URL
 * @param {string} mimeType - MIME type (e.g., 'image/jpeg', 'audio/webm')
 */
export function cacheMedia(messageId, blobUrl, mimeType) {
  // Evict oldest entries if cache is full
  if (mediaCache.size >= MAX_CACHE_SIZE) {
    const firstKey = mediaCache.keys().next().value;
    const evicted = mediaCache.get(firstKey);
    if (evicted) {
      URL.revokeObjectURL(evicted.blobUrl);
      console.log('🗑️ Evicted from cache:', firstKey);
    }
    mediaCache.delete(firstKey);
  }

  mediaCache.set(messageId, {
    blobUrl,
    mimeType,
    timestamp: Date.now(),
  });

  console.log('💾 Cached media for message:', messageId, 'Cache size:', mediaCache.size);
}

/**
 * Check if media is in cache
 * @param {string} messageId - Message ID
 * @returns {boolean}
 */
export function hasCache(messageId) {
  return mediaCache.has(messageId);
}

/**
 * Remove specific media from cache
 * @param {string} messageId - Message ID
 */
export function removeCachedMedia(messageId) {
  const cached = mediaCache.get(messageId);
  if (cached) {
    URL.revokeObjectURL(cached.blobUrl);
    mediaCache.delete(messageId);
    console.log('🗑️ Removed from cache:', messageId);
  }
}

/**
 * Clear all cached media (useful when user logs out)
 */
export function clearMediaCache() {
  mediaCache.forEach((cached) => {
    URL.revokeObjectURL(cached.blobUrl);
  });
  mediaCache.clear();
  console.log('🗑️ Cleared all media cache');
}

/**
 * Get cache statistics
 * @returns {{ size: number, maxSize: number }}
 */
export function getCacheStats() {
  return {
    size: mediaCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}
