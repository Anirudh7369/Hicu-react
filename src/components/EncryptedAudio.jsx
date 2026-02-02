// src/components/EncryptedAudio.jsx
// Component for playing encrypted audio messages with caching

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getDecryptedMediaUrl, downloadDecryptedMedia } from '../services/mediaDownloadService';

const EncryptedAudio = ({ chatId, message, currentUser }) => {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadAudio = async () => {
      try {
        setLoading(true);
        setError(null);

        // Decrypt and get blob URL (cached if already decrypted)
        const { blobUrl } = await getDecryptedMediaUrl({ chatId, message, userEmail: currentUser?.email });
        setAudioUrl(blobUrl);
      } catch (err) {
        console.error('Error loading encrypted audio:', err);
        setError(err.message || 'Failed to load audio');
      } finally {
        setLoading(false);
      }
    };

    loadAudio();

    // Note: We don't revoke blob URLs anymore since they're cached
    // The cache service will handle cleanup when needed

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, message.id, currentUser?.email]); // Only depend on message.id to prevent re-decryption when messages array updates

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const timestamp = message.createdAt?.toDate?.() || new Date();
      // Let downloadDecryptedMedia handle extension extraction from MIME type
      const filename = `audio_${timestamp.getTime()}`;

      await downloadDecryptedMedia({ chatId, message, filename, userEmail: currentUser?.email });
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download audio');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 bg-[#2C2C2E] rounded-lg px-3 py-2 max-w-[240px]">
        <span className="material-symbols-outlined text-xl text-[#A076F9] animate-spin">
          progress_activity
        </span>
        <p className="text-xs text-gray-400">Decrypting...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 bg-[#2C2C2E] rounded-lg px-3 py-2 max-w-[240px]">
        <span className="material-symbols-outlined text-xl text-red-500">error</span>
        <p className="text-xs text-gray-400">Error</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-[#2C2C2E] rounded-lg px-3 py-2 max-w-[280px]">
      <span className="material-symbols-outlined text-xl text-[#A076F9]">mic</span>
      <audio
        src={audioUrl}
        controls
        className="flex-1 min-w-0"
        style={{
          height: '28px',
          maxWidth: '180px',
          filter: 'invert(1) hue-rotate(180deg)',
        }}
      />
      <button
        onClick={handleDownload}
        className="flex items-center justify-center hover:bg-[#3C3C3E] rounded-full p-1.5 transition-colors flex-shrink-0"
        title="Download audio"
      >
        <span className="material-symbols-outlined text-white text-lg">
          download
        </span>
      </button>
    </div>
  );
};

EncryptedAudio.propTypes = {
  chatId: PropTypes.string.isRequired,
  currentUser: PropTypes.object,
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    createdAt: PropTypes.object,
    media: PropTypes.shape({
      filePath: PropTypes.string.isRequired,
      iv: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};

export default EncryptedAudio;
