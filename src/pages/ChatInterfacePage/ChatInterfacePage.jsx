import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { sendChatMessage, subscribeToChatMessages } from '../../services/chatMessagesService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getUserProfile } from '../../services/userProfileService';
import { markMessagesAsRead, isMessageRead, resetUnreadCount } from '../../services/readReceiptService';
import { uploadMedia } from '../../services/mediaUploadService';
import { unsendMessage } from '../../services/messageDeleteService';
import EncryptedImage from '../../components/EncryptedImage';
import EncryptedAudio from '../../components/EncryptedAudio';
import AudioRecorder from '../../components/AudioRecorder';
import { debugStoragePermissions } from '../../utils/debugStorage';

const ChatInterfacePage = ({ onBack, user, chatId }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [chatData, setChatData] = useState(null);
  const [otherUserProfile, setOtherUserProfile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [showMediaDropdown, setShowMediaDropdown] = useState(false);
  const [showProfilePhotoModal, setShowProfilePhotoModal] = useState(false);
  const [longPressMessage, setLongPressMessage] = useState(null);
  const [showUnsendModal, setShowUnsendModal] = useState(false);
  const bottomRef = useRef(null);
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const longPressTimer = useRef(null);

  // Load chat metadata and other user's profile
  useEffect(() => {
    if (!chatId) return;

    const loadChat = async () => {
      try {
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        if (chatSnap.exists()) {
          const data = chatSnap.data();
          setChatData(data);

          // Load other user's profile
          const otherEmail = data.participants?.find(
            (p) => p.toLowerCase() !== user?.email?.toLowerCase()
          );
          if (otherEmail) {
            const profile = await getUserProfile(otherEmail);
            setOtherUserProfile(profile);
          }

          // Messages will be marked as read by the useEffect hook
        }
      } catch (error) {
        console.error('Error loading chat:', error);
      }
    };

    loadChat();
  }, [chatId, user]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!chatId || !user?.email) return;

    const unsubscribe = subscribeToChatMessages({
      chatId,
      userEmail: user.email,
      onMessages: (newMessages) => {
        setMessages(newMessages);
        setLoadingMessages(false);
      },
      onError: (error) => {
        console.error('Error loading messages:', error);
        setLoadingMessages(false);
      },
    });

    // Cleanup listener when component unmounts
    return () => unsubscribe();
  }, [chatId, user?.email]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMediaDropdown && !event.target.closest('.media-dropdown-container')) {
        setShowMediaDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMediaDropdown]);

  // Reset unread count when chat is opened
  useEffect(() => {
    if (chatId && user?.email) {
      resetUnreadCount(chatId, user.email);
    }
  }, [chatId, user?.email]);

  // Mark messages as read when they appear
  useEffect(() => {
    if (messages.length > 0 && user?.email && chatId) {
      markMessagesAsRead(chatId, messages, user.email);
    }
  }, [messages, user?.email, chatId]);

  // Long press handlers
  const handleLongPressStart = (message) => {
    // Only allow unsending your own messages
    if (message.email?.toLowerCase() !== user?.email?.toLowerCase()) {
      return;
    }

    longPressTimer.current = setTimeout(() => {
      setLongPressMessage(message);
      setShowUnsendModal(true);
    }, 500); // 500ms long press
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Unsend message handler
  const handleUnsendMessage = async () => {
    if (!longPressMessage) return;

    try {
      await unsendMessage(chatId, longPressMessage);
      setShowUnsendModal(false);
      setLongPressMessage(null);
    } catch (error) {
      console.error('Error unsending message:', error);
      alert('Failed to unsend message');
    }
  };

  // Get other participant's name
  const getOtherParticipantName = () => {
    if (otherUserProfile?.displayName) {
      return otherUserProfile.displayName;
    }
    if (!chatData?.participants || !user?.email) return 'Chat';
    const otherEmail = chatData.participants.find(
      (p) => p.toLowerCase() !== user.email.toLowerCase()
    );
    return otherEmail?.split('@')[0] || 'Chat';
  };

  // Handle sending a message
  const handleSend = async (e) => {
    e.preventDefault();
    if (inputValue.trim() && user && chatId) {
      try {
        await sendChatMessage({ chatId, text: inputValue, user });
        setInputValue(''); // Clear input after sending
      } catch (error) {
        console.error('Send message error:', error);
        alert(`Failed to send message: ${error.message}`);
      }
    }
  };

  // Handle back button click
  const handleBackClick = () => {
    if (onBack) {
      onBack();
    }
  };

  // Handle image selection - show preview
  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setSelectedImage(file);
    setImageCaption('');

    // Reset file input
    if (e.target) {
      e.target.value = '';
    }
  };

  // Send image after preview confirmation
  const handleSendImage = async () => {
    if (!selectedImage) return;

    try {
      setUploadingImage(true);
      setImagePreview(null);

      console.log('🖼️ Uploading image:', {
        chatId,
        userEmail: user.email,
        fileName: selectedImage.name,
        fileSize: selectedImage.size,
        viewOnce: isViewOnce,
      });

      await debugStoragePermissions(chatId);

      await uploadMedia({
        file: selectedImage,
        chatId,
        user,
        type: 'image',
        caption: imageCaption,
        viewOnce: isViewOnce,
      });

      setSelectedImage(null);
      setImageCaption('');
      setIsViewOnce(false);
    } catch (err) {
      console.error('❌ Image upload error:', err);
      alert(`Failed to send image: ${err.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  // Cancel image preview
  const handleCancelImagePreview = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setSelectedImage(null);
    setImageCaption('');
    setIsViewOnce(false);
  };

  // Handle opening gallery
  const handleOpenGallery = () => {
    setShowMediaDropdown(false);
    galleryInputRef.current?.click();
  };

  // Handle opening camera
  const handleOpenCamera = () => {
    setShowMediaDropdown(false);
    cameraInputRef.current?.click();
  };

  // Handle audio recording completion
  const handleAudioRecorded = async (audioBlob) => {
    try {
      setUploadingAudio(true);
      setShowAudioRecorder(false);

      console.log('🎤 Uploading audio:', {
        chatId,
        userEmail: user.email,
        blobSize: audioBlob.size,
      });

      await debugStoragePermissions(chatId);

      await uploadMedia({
        file: audioBlob,
        chatId,
        user,
        type: 'audio',
      });
    } catch (err) {
      console.error('❌ Audio upload error:', err);
      console.error('Error code:', err.code);
      console.error('Error details:', err);
      alert(`Failed to send audio: ${err.message}`);
    } finally {
      setUploadingAudio(false);
    }
  };

  // Handle audio recording cancel
  const handleAudioCancel = () => {
    setShowAudioRecorder(false);
  };

  // Handle mic button click
  const handleMicClick = () => {
    setShowAudioRecorder(true);
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loadingMessages) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="text-white text-xl">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-full flex-col font-display dark group/design-root">
      {/* Header */}
      <header className="flex shrink-0 items-center bg-black p-4 pb-2 justify-between sticky top-0 z-10">
        <div className="flex size-12 shrink-0 items-center justify-start">
          <button
            className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 bg-transparent text-[#A076F9] gap-2 text-base font-bold leading-normal tracking-[0.015em] min-w-0 p-0"
            onClick={handleBackClick}
          >
            <span className="material-symbols-outlined text-2xl">
              arrow_back_ios_new
            </span>
          </button>
        </div>

        {/* Enhanced Profile Pill */}
        <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
          <img
            src={otherUserProfile?.photoURL || 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=150'}
            alt={getOtherParticipantName()}
            referrerPolicy="no-referrer"
            className="rounded-full size-10 object-cover flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-[#A076F9] transition-all"
            onClick={() => setShowProfilePhotoModal(true)}
            onError={(e) => {
              e.target.src = 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=150';
            }}
          />
          <div className="flex flex-col min-w-0 flex-1">
            <h2 className="text-white text-base font-bold leading-tight truncate">
              {getOtherParticipantName()}
            </h2>
            {(otherUserProfile?.status || otherUserProfile?.zodiac) && (
              <div className="flex items-center gap-2 text-xs">
                {otherUserProfile?.status && (
                  <span className="text-gray-400 truncate flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-[#A076F9]" style={{ fontSize: '14px' }}>
                      mood
                    </span>
                    {otherUserProfile.status}
                  </span>
                )}
                {otherUserProfile?.zodiac && (
                  <span className="text-[#A076F9] flex items-center gap-1 flex-shrink-0">
                    <span className="material-symbols-outlined text-sm" style={{ fontSize: '14px' }}>
                      stars
                    </span>
                    {otherUserProfile.zodiac}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Message List */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-2 bg-black">
        <div className="flex flex-col gap-4">
          {/* Date separator */}
          <div className="flex justify-center my-2">
            <p className="text-xs text-gray-500">Today</p>
          </div>

          {/* Messages */}
          {messages.map((message) => {
            const isMe = message.uid === user?.uid;
            const isImageMessage = message.type === 'image';
            const isAudioMessage = message.type === 'audio';

            // Skip old Cloudinary format messages (legacy)
            const isLegacyCloudinary = message.media?.publicId && !message.media?.filePath;

            return isMe ? (
              // Outgoing message (my message)
              <div
                key={message.id}
                className="flex items-end gap-3 justify-end"
                onMouseDown={() => handleLongPressStart(message)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                onTouchStart={() => handleLongPressStart(message)}
                onTouchEnd={handleLongPressEnd}
              >
                <div className="flex flex-1 flex-col gap-1 items-end max-w-[80%]">
                  {isLegacyCloudinary ? (
                    <div className="flex max-w-full rounded-lg bg-[#2C2C2E] px-4 py-3">
                      <p className="text-sm text-gray-400 italic">
                        [Legacy media - please re-send]
                      </p>
                    </div>
                  ) : isImageMessage ? (
                    <div className="flex flex-col gap-2 items-end">
                      <EncryptedImage chatId={chatId} message={message} currentUser={user} />
                      {message.caption && (
                        <div className="flex max-w-full rounded-lg bg-gradient-to-r from-[#6A11CB] to-[#FC5C7D] px-4 py-2">
                          <p className="text-sm font-normal leading-normal text-white">
                            {message.caption}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : isAudioMessage ? (
                    <EncryptedAudio chatId={chatId} message={message} currentUser={user} />
                  ) : (
                    <div className="flex max-w-full rounded-lg bg-gradient-to-r from-[#6A11CB] to-[#FC5C7D] px-4 py-3">
                      <p className="text-base font-normal leading-normal text-white">
                        {message.text}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <p className="text-gray-500 text-xs px-1">{formatTime(message.createdAt)}</p>
                    <span className="material-symbols-outlined text-base text-[#A076F9]">
                      {isMessageRead(message, user.email) ? 'done_all' : 'done'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              // Incoming message
              <div key={message.id} className="flex items-start gap-3 justify-start">
                <img
                  src={otherUserProfile?.photoURL || 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=150'}
                  alt={message.displayName}
                  referrerPolicy="no-referrer"
                  className="rounded-full size-8 object-cover flex-shrink-0"
                  onError={(e) => {
                    e.target.src = 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=150';
                  }}
                />
                <div className="flex flex-1 flex-col gap-1 items-start max-w-[80%]">
                  <p className="text-xs text-gray-400">{message.displayName}</p>
                  {isLegacyCloudinary ? (
                    <div className="flex max-w-full rounded-lg bg-[#2C2C2E] px-4 py-3">
                      <p className="text-sm text-gray-400 italic">
                        [Legacy media - please re-send]
                      </p>
                    </div>
                  ) : isImageMessage ? (
                    <div className="flex flex-col gap-2">
                      <EncryptedImage chatId={chatId} message={message} currentUser={user} />
                      {message.caption && (
                        <div className="flex max-w-full rounded-lg bg-[#2C2C2E] px-4 py-2">
                          <p className="text-sm font-normal leading-normal text-white">
                            {message.caption}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : isAudioMessage ? (
                    <EncryptedAudio chatId={chatId} message={message} currentUser={user} />
                  ) : (
                    <div className="flex max-w-full rounded-lg bg-[#2C2C2E] px-4 py-3">
                      <p className="text-base font-normal leading-normal text-white">
                        {message.text}
                      </p>
                    </div>
                  )}
                  <p className="text-gray-500 text-xs px-1">{formatTime(message.createdAt)}</p>
                </div>
              </div>
            );
          })}

          {/* Auto-scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Image Preview Modal */}
      {imagePreview && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <button
              onClick={handleCancelImagePreview}
              className="flex items-center justify-center p-2 hover:bg-[#2C2C2E] rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-white text-2xl">close</span>
            </button>
            <h3 className="text-white text-lg font-semibold">Preview Image</h3>
            <div className="w-10"></div>
          </div>

          {/* Image Preview */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>

          {/* View Once Toggle */}
          <div className="px-4 pb-2">
            <button
              onClick={() => setIsViewOnce(!isViewOnce)}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                isViewOnce ? 'bg-[#A076F9]' : 'bg-[#1C1C1E]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-white text-xl">
                  {isViewOnce ? 'visibility_off' : 'visibility'}
                </span>
                <span className="text-white text-sm font-medium">View Once</span>
              </div>
              <div className={`w-12 h-6 rounded-full transition-colors ${
                isViewOnce ? 'bg-white' : 'bg-[#2C2C2E]'
              } relative`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-[#A076F9] transition-transform ${
                  isViewOnce ? 'translate-x-7' : 'translate-x-1'
                }`}></div>
              </div>
            </button>
          </div>

          {/* Caption Input */}
          <div className="px-4 pb-2">
            <input
              type="text"
              placeholder="Add a caption (optional)..."
              value={imageCaption}
              onChange={(e) => setImageCaption(e.target.value)}
              className="w-full bg-[#1C1C1E] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A076F9] placeholder:text-gray-500"
            />
          </div>

          {/* Send Button */}
          <div className="p-4">
            <button
              onClick={handleSendImage}
              disabled={uploadingImage}
              className="w-full bg-gradient-to-r from-[#6A11CB] to-[#FC5C7D] text-white rounded-lg py-3 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploadingImage ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">send</span>
                  <span>{isViewOnce ? 'Send View Once' : 'Send Image'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Footer Input */}
      <footer className="flex flex-col px-4 py-3 gap-3 bg-black sticky bottom-0 relative">
        {/* Hidden file inputs */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleImagePick}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImagePick}
          className="hidden"
        />

        {/* Media Dropdown */}
        {showMediaDropdown && (
          <div className="absolute bottom-16 left-4 bg-[#1C1C1E] rounded-lg shadow-lg overflow-hidden z-10 media-dropdown-container">
            <button
              onClick={handleOpenGallery}
              className="flex items-center gap-3 px-4 py-3 w-full hover:bg-[#2C2C2E] transition-colors"
            >
              <span className="material-symbols-outlined text-[#A076F9] text-xl">image</span>
              <span className="text-white text-sm">Gallery</span>
            </button>
            <button
              onClick={handleOpenCamera}
              className="flex items-center gap-3 px-4 py-3 w-full hover:bg-[#2C2C2E] transition-colors"
            >
              <span className="material-symbols-outlined text-[#A076F9] text-xl">photo_camera</span>
              <span className="text-white text-sm">Camera</span>
            </button>
          </div>
        )}

        {/* Audio Recorder */}
        {showAudioRecorder && (
          <AudioRecorder
            onRecordingComplete={handleAudioRecorded}
            onCancel={handleAudioCancel}
          />
        )}

        {/* Status messages */}
        {uploadingAudio && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="material-symbols-outlined text-base animate-spin">
              progress_activity
            </span>
            <span>Uploading audio...</span>
          </div>
        )}

        {/* Message Input */}
        {!showAudioRecorder && (
          <form onSubmit={handleSend} className="flex flex-col min-w-40 h-12 flex-1">
            <div className="flex w-full flex-1 items-stretch rounded-lg h-full bg-[#1C1C1E]">
              <button
                type="button"
                className="flex items-center justify-center pl-3 relative media-dropdown-container"
                onClick={() => setShowMediaDropdown(!showMediaDropdown)}
                disabled={uploadingImage || uploadingAudio}
              >
                <span className="material-symbols-outlined text-[#A076F9] text-2xl">
                  {uploadingImage ? 'progress_activity' : 'add_circle'}
                </span>
              </button>
              <input
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden text-white focus:outline-0 focus:ring-0 border-none bg-transparent h-full placeholder:text-gray-500 px-3 text-base font-normal leading-normal"
                placeholder={uploadingImage ? 'Uploading image...' : 'Send message...'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={uploadingImage || uploadingAudio}
              />
              <button
                type={inputValue.trim() ? 'submit' : 'button'}
                className="flex items-center justify-center pr-3"
                disabled={uploadingImage || uploadingAudio}
                onClick={!inputValue.trim() ? handleMicClick : undefined}
              >
                <span className="material-symbols-outlined text-[#A076F9] text-2xl">
                  {inputValue.trim() ? 'send' : 'mic'}
                </span>
              </button>
            </div>
          </form>
        )}
      </footer>

      {/* Profile Photo Full Screen Modal */}
      {showProfilePhotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setShowProfilePhotoModal(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowProfilePhotoModal(false)}
            className="fixed top-4 right-4 bg-black/50 hover:bg-black/70 rounded-full p-3 z-10 transition-all"
          >
            <span className="material-symbols-outlined text-white text-2xl">
              close
            </span>
          </button>

          {/* Profile info */}
          <div className="flex flex-col items-center gap-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            {/* Large profile photo */}
            <div className="relative">
              <img
                src={otherUserProfile?.photoURL || 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=400'}
                alt={getOtherParticipantName()}
                referrerPolicy="no-referrer"
                className="rounded-full w-64 h-64 object-cover border-4 border-[#A076F9] shadow-2xl"
                onError={(e) => {
                  e.target.src = 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=400';
                }}
              />
            </div>

            {/* User info */}
            <div className="flex flex-col items-center gap-3 text-center">
              <h2 className="text-white text-3xl font-bold">
                {getOtherParticipantName()}
              </h2>
              <p className="text-gray-400 text-sm">
                {chatData?.participants?.find((p) => p.toLowerCase() !== user?.email?.toLowerCase())}
              </p>

              {/* Status and Zodiac */}
              {(otherUserProfile?.status || otherUserProfile?.zodiac) && (
                <div className="flex flex-col gap-2 mt-2">
                  {otherUserProfile?.status && (
                    <div className="flex items-center gap-2 bg-surface-dark/50 px-4 py-2 rounded-full">
                      <span className="material-symbols-outlined text-[#A076F9] text-lg">
                        mood
                      </span>
                      <span className="text-white text-sm">{otherUserProfile.status}</span>
                    </div>
                  )}
                  {otherUserProfile?.zodiac && (
                    <div className="flex items-center gap-2 bg-surface-dark/50 px-4 py-2 rounded-full">
                      <span className="material-symbols-outlined text-[#A076F9] text-lg">
                        stars
                      </span>
                      <span className="text-white text-sm">{otherUserProfile.zodiac}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unsend Message Modal */}
      {showUnsendModal && longPressMessage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => {
            setShowUnsendModal(false);
            setLongPressMessage(null);
          }}
        >
          <div
            className="bg-surface-dark/95 backdrop-blur-md rounded-lg p-6 max-w-sm w-full border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white text-lg font-bold mb-4">Unsend Message?</h3>
            <p className="text-gray-400 text-sm mb-6">
              This message will be deleted for everyone. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUnsendModal(false);
                  setLongPressMessage(null);
                }}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUnsendMessage}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Unsend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ChatInterfacePage.propTypes = {
  onBack: PropTypes.func,
  user: PropTypes.object,
  chatId: PropTypes.string,
};

export default ChatInterfacePage;
