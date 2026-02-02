import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import LoginPage from './pages/LoginPage/LoginPage';
import ChatListPage from './pages/ChatPage/ChatListPage';
import ChatInterfacePage from './pages/ChatInterfacePage/ChatInterfacePage';
import ProfilePage from './pages/ProfilePage/ProfilePage';
import { auth, googleProvider } from './firebase';
import { isUserAllowed } from './services/allowlistService';
import { updateUserProfile, getUserProfile } from './services/userProfileService';
import { initializeUserKeyPair } from './crypto/publicKeyManager';

function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [checkingAllowlist, setCheckingAllowlist] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Helper function to load and merge user data from Auth and Firestore
  const loadUserData = async (authUser) => {
    try {
      // Get Firestore profile
      const firestoreProfile = await getUserProfile(authUser.email);

      // Merge Auth user with Firestore profile (Firestore takes precedence)
      const mergedUser = {
        uid: authUser.uid,
        email: authUser.email,
        displayName: firestoreProfile?.displayName || authUser.displayName || authUser.email.split('@')[0],
        photoURL: firestoreProfile?.photoURL || authUser.photoURL || '',
        // Include Firestore-only fields
        zodiac: firestoreProfile?.zodiac || '',
        status: firestoreProfile?.status || '',
      };

      console.log('✅ Loaded user data:', {
        email: mergedUser.email,
        displayName: mergedUser.displayName,
        hasPhotoURL: !!mergedUser.photoURL,
      });

      return mergedUser;
    } catch (error) {
      console.error('Error loading user data:', error);
      // Fallback to auth user
      return {
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName || authUser.email.split('@')[0],
        photoURL: authUser.photoURL || '',
        zodiac: '',
        status: '',
      };
    }
  };

  // Auth state listener - automatically detects login/logout/session restore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // User is signed in - check if they're on the allowlist
        setCheckingAllowlist(true);
        const allowed = await isUserAllowed(currentUser.email);
        setCheckingAllowlist(false);

        if (allowed) {
          // User is allowed - save their profile and proceed to chat
          await updateUserProfile(currentUser);

          // Initialize RSA key pair for E2E encryption
          try {
            await initializeUserKeyPair(currentUser.email);
            console.log('✅ User RSA key pair initialized');
          } catch (error) {
            console.error('Failed to initialize key pair:', error);
            // Don't block login if key pair generation fails
          }

          // Load merged user data (Auth + Firestore)
          const mergedUser = await loadUserData(currentUser);
          setUser(mergedUser);
          setCurrentPage('chatlist');
        } else {
          // User is NOT allowed - sign them out and show message
          await signOut(auth);
          alert(
            `Access Denied\n\nThe email "${currentUser.email}" is not authorized to use this app.\n\nPlease contact the administrator if you believe this is an error.`
          );
          setUser(null);
          setCurrentPage('login');
        }
      } else {
        // User is signed out
        setUser(null);
        setCurrentPage('login');
      }

      setAuthLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for service worker updates
  useEffect(() => {
    const handleUpdateAvailable = (event) => {
      console.log('📢 App: Received update-available event');

      // Get waiting worker from global reference (set by index.js)
      const worker = window.__waitingServiceWorker || event.detail?.waitingWorker;

      if (worker) {
        console.log('✅ App: Stored waiting worker reference');
        setWaitingWorker(worker);
        setUpdateAvailable(true);
      } else {
        console.warn('⚠️ App: No waiting worker found, but update event received');
        setUpdateAvailable(true);
      }
    };

    window.addEventListener('sw-update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleUpdateApp = async () => {
    console.log('🔄 App: Update button clicked!');
    setIsUpdating(true);

    try {
      // Strategy 1: Use stored waiting worker (most reliable)
      if (waitingWorker) {
        console.log('📤 App: Sending SKIP_WAITING to stored waiting worker');
        const messageChannel = new MessageChannel();

        // Set up timeout fallback (3 seconds)
        const timeoutId = setTimeout(() => {
          console.warn('⏰ App: Timeout waiting for SW activation, forcing reload...');
          window.location.reload();
        }, 3000);

        // Listen for acknowledgment
        messageChannel.port1.onmessage = (event) => {
          if (event.data.type === 'SKIP_WAITING_ACK') {
            console.log('✅ App: Received SKIP_WAITING acknowledgment');
            clearTimeout(timeoutId);
          }
        };

        waitingWorker.postMessage({ type: 'SKIP_WAITING' }, [messageChannel.port2]);
        console.log('📨 App: Message sent, waiting for activation...');
        return;
      }

      // Strategy 2: Look up registration.waiting
      console.log('📍 App: No stored worker, looking up registration...');
      const registration = window.__swRegistration || await navigator.serviceWorker.getRegistration();

      if (registration && registration.waiting) {
        console.log('📤 App: Found registration.waiting, sending message');
        const messageChannel = new MessageChannel();

        const timeoutId = setTimeout(() => {
          console.warn('⏰ App: Timeout, forcing reload...');
          window.location.reload();
        }, 3000);

        messageChannel.port1.onmessage = (event) => {
          if (event.data.type === 'SKIP_WAITING_ACK') {
            console.log('✅ App: Received acknowledgment');
            clearTimeout(timeoutId);
          }
        };

        registration.waiting.postMessage({ type: 'SKIP_WAITING' }, [messageChannel.port2]);
        console.log('📨 App: Message sent via registration.waiting');
        return;
      }

      // Strategy 3: Send to controller (less ideal)
      if (navigator.serviceWorker.controller) {
        console.log('📤 App: No waiting worker, trying controller...');
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });

        // Force reload after 2 seconds
        setTimeout(() => {
          console.log('🔃 App: Force reloading after controller message...');
          window.location.reload();
        }, 2000);
        return;
      }

      // Strategy 4: Direct reload as last resort
      console.warn('⚠️ App: No service worker found, forcing reload');
      window.location.reload();

    } catch (error) {
      console.error('❌ App: Error during update:', error);
      // Force reload on any error
      console.log('🔃 App: Error occurred, forcing reload...');
      window.location.reload();
    }
  };

  const handleNavigation = (pageName, params) => {
    if (pageName === 'chat' && params?.chatId) {
      setCurrentChatId(params.chatId);
      setCurrentPage('chatinterface');
    } else {
      setCurrentPage(pageName);
    }
  };

  // Google Sign-In handler
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // No need to manually navigate or set user state
      // onAuthStateChanged will automatically fire and update UI
    } catch (error) {
      console.error('Google Sign-In error:', error);
      alert(`Login failed: ${error.message}`);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged will automatically fire and show login page
    } catch (error) {
      console.error('Logout error:', error);
      alert(`Logout failed: ${error.message}`);
    }
  };

  const handleBackToList = () => {
    setCurrentPage('chatlist');
  };

  // Handle profile save - reload user data to pick up changes
  const handleProfileSave = async () => {
    if (!user?.uid) return;

    try {
      // Get current auth user
      const currentAuthUser = auth.currentUser;
      if (currentAuthUser) {
        // Reload merged user data to pick up Firestore changes
        const mergedUser = await loadUserData(currentAuthUser);
        setUser(mergedUser);
        console.log('✅ User data refreshed after profile save');
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }

    setCurrentPage('chatlist');
  };

  // Show loading screen while checking auth state or allowlist
  if (authLoading || checkingAllowlist) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#000000]">
        <div className="text-white text-xl">
          {checkingAllowlist ? 'Verifying access...' : 'Loading...'}
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {/* Update notification banner */}
      {updateAvailable && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined">
              {isUpdating ? 'progress_activity' : 'refresh'}
            </span>
            <span className="font-medium">
              {isUpdating ? 'Updating...' : 'A new version is available!'}
            </span>
          </div>
          <button
            onClick={handleUpdateApp}
            disabled={isUpdating}
            className="bg-white text-primary px-4 py-1 rounded-full font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? 'Please wait...' : 'Update Now'}
          </button>
        </div>
      )}

      {currentPage === 'login' && (
        <LoginPage onGoogleLogin={handleGoogleLogin} />
      )}
      {currentPage === 'chatlist' && (
        <ChatListPage onNavigate={handleNavigation} onLogout={handleLogout} user={user} />
      )}
      {currentPage === 'chatinterface' && (
        <ChatInterfacePage onBack={handleBackToList} user={user} chatId={currentChatId} />
      )}
      {currentPage === 'profile' && (
        <ProfilePage onBack={handleBackToList} onSave={handleProfileSave} onLogout={handleLogout} user={user} />
      )}
      {/* Add more page components here as needed */}
    </div>
  );
}

export default App;
