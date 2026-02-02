import { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { subscribeToMyDmChats } from '../../services/dmChatListService';
import { getOrCreateDmChat } from '../../services/dmChatService';
import { getUserProfile } from '../../services/userProfileService';
import { searchUsers } from '../../services/userSearchService';

const ChatListPage = ({ onNavigate, onLogout, user }) => {
  const [chats, setChats] = useState([]);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [userProfiles, setUserProfiles] = useState({});
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const dropdownRef = useRef(null);

  // Load user profiles for chat participants
  const loadUserProfiles = useCallback(async (chatList) => {
    const emails = new Set();

    chatList.forEach((chat) => {
      chat.participants?.forEach((email) => {
        if (email.toLowerCase() !== user.email?.toLowerCase()) {
          emails.add(email);
        }
      });
    });

    const profiles = {};
    for (const email of emails) {
      const profile = await getUserProfile(email);
      profiles[email] = profile;
    }

    setUserProfiles(profiles);
  }, [user]);

  // Subscribe to real-time DM chats
  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = subscribeToMyDmChats({
      myEmail: user.email,
      onChats: (newChats) => {
        setChats(newChats);
        setLoadingChats(false);

        // Load user profiles for all participants
        loadUserProfiles(newChats);
      },
      onError: (error) => {
        console.error('Error loading chats:', error);
        setLoadingChats(false);
      },
    });

    return () => unsubscribe();
  }, [user, loadUserProfiles]);

  // Get other participant's email from chat
  const getOtherParticipant = (chat) => {
    return chat.participants?.find((p) => p.toLowerCase() !== user.email?.toLowerCase());
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // No filtering needed - show all chats
  const filteredChats = chats;

  // Handle chat item click
  const handleChatClick = (chatId) => {
    if (onNavigate) {
      onNavigate('chat', { chatId });
    }
  };

  // Toggle profile dropdown
  const toggleProfileDropdown = () => {
    setShowProfileDropdown(!showProfileDropdown);
  };

  // Handle logout
  const handleLogout = () => {
    setShowProfileDropdown(false);
    if (onLogout) {
      onLogout();
    }
  };

  // Handle my profile
  const handleMyProfile = () => {
    setShowProfileDropdown(false);
    if (onNavigate) {
      onNavigate('profile');
    }
  };

  // Handle PWA install prompt
  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('App is already installed or cannot be installed on this device.');
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowInstallButton(false);
    setShowProfileDropdown(false);
  };

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show the install button
      setShowInstallButton(true);
      console.log('PWA install prompt available');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallButton(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Handle user search
  const handleUserSearch = async (query) => {
    setUserSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    try {
      const results = await searchUsers(query, user?.email);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  // Handle selecting a user from search results
  const handleSelectUser = async (selectedUser) => {
    setCreatingChat(true);
    try {
      const { chatId } = await getOrCreateDmChat({
        myEmail: user.email,
        otherEmail: selectedUser.email,
      });

      setShowNewChatModal(false);
      setUserSearchQuery('');
      setSearchResults([]);
      setCreatingChat(false);

      // Navigate to the chat
      if (onNavigate) {
        onNavigate('chat', { chatId });
      }
    } catch (error) {
      console.error('Error creating chat:', error);

      let errorMessage = 'Failed to create chat. ';

      if (error.code === 'permission-denied') {
        errorMessage += 'Permission denied. Make sure:\n\n';
        errorMessage += '1. You have updated Firestore rules in Firebase Console\n';
        errorMessage += '2. Your email is in the allowed_emails collection\n';
        errorMessage += '3. The rules are published\n\n';
        errorMessage += 'Check the browser console for more details.';
      } else {
        errorMessage += error.message || 'Please try again.';
      }

      alert(errorMessage);
      setCreatingChat(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col font-display group/design-root overflow-x-hidden bg-background-dark text-white">
      {/* Radial gradient background */}
      <div className="absolute top-0 left-0 w-full h-[400px] bg-[radial-gradient(ellipse_40%_50%_at_50%_0%,_rgba(164,19,236,0.3),_rgba(0,0,0,0))] pointer-events-none -z-1 opacity-70"></div>

      <main className="flex-1">
        {/* Top bar with profile */}
        <div className="flex items-center bg-transparent p-4 pb-2 justify-between sticky top-0 z-20">
          <div className="flex size-12 shrink-0 items-center justify-start relative" ref={dropdownRef}>
            <img
              src={user?.photoURL || 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=150'}
              alt="Profile"
              referrerPolicy="no-referrer"
              className="aspect-square rounded-full size-10 cursor-pointer hover:ring-2 hover:ring-primary transition-all object-cover bg-gray-600"
              onClick={toggleProfileDropdown}
              role="button"
              aria-label="Profile menu"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleProfileDropdown();
                }
              }}
              onError={(e) => {
                e.target.src = 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=150';
              }}
            />

            {/* Profile Dropdown */}
            {showProfileDropdown && (
              <div className="absolute top-12 left-0 w-48 bg-surface-dark/95 backdrop-blur-md shadow-lg overflow-hidden border border-white/10">
                <button
                  onClick={handleMyProfile}
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-xl">person</span>
                  <span className="text-sm font-medium">My Profile</span>
                </button>
                {showInstallButton && (
                  <button
                    onClick={handleInstallClick}
                    className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-3 border-t border-white/10"
                  >
                    <span className="material-symbols-outlined text-xl">download</span>
                    <span className="text-sm font-medium">Install App</span>
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-3 border-t border-white/10"
                >
                  <span className="material-symbols-outlined text-xl">logout</span>
                  <span className="text-sm font-medium">Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chats header */}
        <div className="flex flex-col px-4 pt-4">
          <h2 className="text-white text-2xl font-bold leading-tight tracking-tight">
            Chats
          </h2>
        </div>

        {/* Chat list */}
        <div className="flex flex-col">
          {loadingChats ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <p className="text-text-secondary-dark text-base">Loading chats...</p>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <p className="text-text-secondary-dark text-base">
                No chats yet. Start a conversation!
              </p>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const otherParticipant = getOtherParticipant(chat);
              const profile = userProfiles[otherParticipant];
              const displayName = profile?.displayName || otherParticipant?.split('@')[0] || 'Unknown';
              const unreadCount = chat.unreadCount?.[user.email?.toLowerCase()] || 0;
              const hasUnread = unreadCount > 0;

              return (
                <div
                  key={chat.id}
                  className="flex flex-col group hover:bg-white/5 active:bg-white/10 transition-colors duration-200 cursor-pointer"
                  onClick={() => handleChatClick(chat.id)}
                >
                  <div className="flex items-center gap-4 px-4 min-h-[72px] py-3 justify-between">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="relative shrink-0">
                        <img
                          src={profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4A4A4A&color=fff&size=150`}
                          alt={displayName}
                          referrerPolicy="no-referrer"
                          className="aspect-square rounded-full size-14 object-cover bg-gray-600"
                          onError={(e) => {
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4A4A4A&color=fff&size=150`;
                          }}
                        />
                      </div>
                      <div className="flex flex-col justify-center overflow-hidden">
                        <p className="text-white text-base font-bold leading-normal truncate">
                          {displayName}
                        </p>
                        <p
                          className={`text-sm leading-normal truncate ${
                            hasUnread
                              ? 'text-white font-bold'
                              : 'text-text-secondary-dark font-normal'
                          }`}
                        >
                          {chat.lastMessage || 'No messages yet'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-1.5">
                      <p className="text-text-secondary-dark text-sm font-normal leading-normal">
                        {formatTime(chat.updatedAt)}
                      </p>
                      {hasUnread && (
                        <div className="bg-primary rounded-full px-2 py-0.5 min-w-[20px] flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="h-px w-full bg-surface-dark ml-22"></div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <button
        className="fixed bottom-6 right-6 size-14 bg-gradient-to-r from-[#6A11CB] to-[#FC5C7D] rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-30"
        onClick={() => setShowNewChatModal(true)}
        aria-label="New chat"
      >
        <span className="material-symbols-outlined text-white text-3xl">add</span>
      </button>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-surface-dark border border-white/10 rounded-lg w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 pb-4">
              <h3 className="text-white text-xl font-bold mb-4">Start New Chat</h3>
              <p className="text-text-secondary-dark text-sm mb-4">
                Search by name or email
              </p>
              <input
                type="text"
                placeholder="Search users..."
                value={userSearchQuery}
                onChange={(e) => handleUserSearch(e.target.value)}
                className="w-full px-4 py-3 bg-[#1C1C1E] text-white rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={creatingChat}
                autoFocus
              />
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {searchingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-text-secondary-dark text-sm">Searching...</p>
                </div>
              ) : userSearchQuery.trim().length < 2 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-text-secondary-dark text-sm">
                    Type at least 2 characters to search
                  </p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-text-secondary-dark text-sm">No users found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div
                      key={result.email}
                      onClick={() => handleSelectUser(result)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                    >
                      <img
                        src={result.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(result.displayName || 'User')}&background=4A4A4A&color=fff&size=150`}
                        alt={result.displayName}
                        referrerPolicy="no-referrer"
                        className="rounded-full size-10 object-cover bg-gray-600 flex-shrink-0"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(result.displayName || 'User')}&background=4A4A4A&color=fff&size=150`;
                        }}
                      />
                      <div className="flex-1 overflow-hidden">
                        <p className="text-white font-medium truncate">
                          {result.displayName || 'Unknown'}
                        </p>
                        <p className="text-text-secondary-dark text-sm truncate">
                          {result.email}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                  setUserSearchQuery('');
                  setSearchResults([]);
                }}
                className="w-full px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                disabled={creatingChat}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ChatListPage.propTypes = {
  onNavigate: PropTypes.func,
  onLogout: PropTypes.func,
  user: PropTypes.object,
};

export default ChatListPage;
