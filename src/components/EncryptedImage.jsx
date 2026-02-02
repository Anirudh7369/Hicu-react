// src/components/EncryptedImage.jsx
// Component for displaying encrypted images with caching and view once support

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getDecryptedMediaUrl, downloadDecryptedMedia } from '../services/mediaDownloadService';
import { markAsViewed, deleteViewOnceMessage, hasUserViewed } from '../services/viewOnceService';

const EncryptedImage = ({ chatId, message, currentUser }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const isViewOnce = message.viewOnce || false;
  const isSentByMe = message.email?.toLowerCase() === currentUser?.email?.toLowerCase();
  const [hasViewed, setHasViewed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if user has viewed this view once message
  useEffect(() => {
    if (isViewOnce && currentUser?.email && !isSentByMe) {
      const viewed = hasUserViewed(message, currentUser.email);
      setHasViewed(viewed);
    }
  }, [isViewOnce, currentUser, message, isSentByMe]);

  useEffect(() => {
    const loadImage = async () => {
      // Don't load image if it's view once and already viewed by receiver
      if (isViewOnce && hasViewed && !isSentByMe) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Decrypt and get blob URL (cached if already decrypted)
        const { blobUrl } = await getDecryptedMediaUrl({ chatId, message, userEmail: currentUser?.email });
        setImageUrl(blobUrl);
      } catch (err) {
        console.error('Error loading encrypted image:', err);
        setError(err.message || 'Failed to load image');
      } finally {
        setLoading(false);
      }
    };

    loadImage();

    // Note: We don't revoke blob URLs anymore since they're cached
    // The cache service will handle cleanup when needed

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, message.id, isViewOnce, hasViewed, isSentByMe, currentUser?.email]); // Only depend on message.id to prevent re-decryption when messages array updates

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const timestamp = message.createdAt?.toDate?.() || new Date();
      // Let downloadDecryptedMedia handle extension extraction from MIME type
      const filename = `image_${timestamp.getTime()}`;

      await downloadDecryptedMedia({ chatId, message, filename, userEmail: currentUser?.email });
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download image');
    }
  };

  const handleViewOnceClick = async () => {
    if (!currentUser?.email) return;

    try {
      // Mark as viewed in Firestore
      await markAsViewed(chatId, message.id, currentUser.email);
      setHasViewed(true);

      // Show the image
      setShowFullScreen(true);
    } catch (err) {
      console.error('Error viewing image:', err);
      alert('Failed to view image');
    }
  };

  const handleImageClick = () => {
    if (isViewOnce && !isSentByMe && !hasViewed) {
      handleViewOnceClick();
    } else {
      setShowFullScreen(true);
    }
  };

  const handleCloseFullScreen = async (e) => {
    e.stopPropagation();
    setShowFullScreen(false);

    // Delete view once message after viewing (only for receiver)
    if (isViewOnce && !isSentByMe && hasViewed) {
      try {
        setIsDeleting(true);
        await deleteViewOnceMessage(chatId, message.id, message.media.filePath);
      } catch (err) {
        console.error('Error deleting view once message:', err);
        // Don't show error to user, message will be deleted eventually
      }
    }
  };

  // If deleting, show nothing
  if (isDeleting) {
    return null;
  }

  // Show "Viewed" indicator for view once messages that have been viewed
  // But don't show it while the full screen modal is open
  if (isViewOnce && hasViewed && !isSentByMe && !showFullScreen) {
    return (
      <div className="flex items-center justify-center w-64 h-40 bg-[#2C2C2E] rounded-lg">
        <div className="flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-4xl text-gray-500">
            visibility_off
          </span>
          <p className="text-sm text-gray-400">Viewed</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center w-64 h-40 bg-[#2C2C2E] rounded-lg">
        <div className="flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-4xl text-[#A076F9] animate-spin">
            progress_activity
          </span>
          <p className="text-sm text-gray-400">Decrypting...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-64 h-40 bg-[#2C2C2E] rounded-lg">
        <div className="flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-4xl text-red-500">error</span>
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Thumbnail */}
      <div className="relative group">
        {isViewOnce && !isSentByMe ? (
          // View Once - Blurred with button
          <div className="relative w-64 h-40 bg-[#2C2C2E] rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt="View Once"
              className="w-full h-full object-cover blur-3xl opacity-50"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <button
                onClick={handleViewOnceClick}
                className="flex flex-col items-center gap-2 hover:scale-105 transition-transform"
              >
                <div className="bg-[#A076F9] rounded-full p-4">
                  <span className="material-symbols-outlined text-white text-3xl">
                    visibility
                  </span>
                </div>
                <p className="text-white text-sm font-medium">View Once</p>
              </button>
            </div>
          </div>
        ) : (
          // Normal image
          <>
            <div className="relative">
              <img
                src={imageUrl}
                alt="Encrypted"
                className="max-w-full max-h-80 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={handleImageClick}
              />
              {isViewOnce && (
                <div className="absolute top-2 left-2 bg-[#A076F9] rounded-full px-3 py-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-white text-sm">visibility_off</span>
                  <span className="text-white text-xs font-medium">View Once</span>
                </div>
              )}
            </div>
            {/* Download button overlay - hide for view once */}
            {!isViewOnce && (
              <button
                onClick={handleDownload}
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Download image"
              >
                <span className="material-symbols-outlined text-white text-xl">
                  download
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Full-screen modal */}
      {showFullScreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={handleCloseFullScreen}
        >
          {/* Close button */}
          <button
            onClick={handleCloseFullScreen}
            className="fixed top-4 right-4 bg-black/50 hover:bg-black/70 rounded-full p-2 z-10"
          >
            <span className="material-symbols-outlined text-white text-2xl">
              close
            </span>
          </button>

          {/* Download button - hide for view once */}
          {!isViewOnce && (
            <button
              onClick={handleDownload}
              className="fixed top-4 right-16 bg-black/50 hover:bg-black/70 rounded-full p-2 z-10"
            >
              <span className="material-symbols-outlined text-white text-2xl">
                download
              </span>
            </button>
          )}

          {/* Full-size image - constrained to viewport */}
          <img
            src={imageUrl}
            alt="Encrypted (full size)"
            className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

EncryptedImage.propTypes = {
  chatId: PropTypes.string.isRequired,
  currentUser: PropTypes.object,
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    email: PropTypes.string,
    createdAt: PropTypes.object,
    viewOnce: PropTypes.bool,
    viewedBy: PropTypes.array,
    media: PropTypes.shape({
      filePath: PropTypes.string.isRequired,
      iv: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};

export default EncryptedImage;
