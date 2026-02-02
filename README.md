# Hicu Chat

A secure, real-time chat application with end-to-end encryption, built with React and Firebase.

## Features

### 🔐 Security & Privacy
- **End-to-End Encryption (E2EE)** using RSA + AES-256-GCM
  - RSA-2048 for key exchange
  - AES-256-GCM for message and media encryption
  - Zero-knowledge architecture - server cannot read messages
- **Encrypted Media** - Images and voice messages stored encrypted
- **View Once Media** - Self-destructing images (delete after viewing)
- **Allowlist-based Access** - Only approved users can sign in

### 💬 Messaging
- Real-time text messaging with Firestore
- Image sharing with captions
- Voice message recording and playback
- Message unsend (delete for everyone)
- Read receipts (single/double check marks)
- Unread message count badges
- Encrypted message previews in chat list

### 🎨 User Experience
- Google Sign-In authentication
- User profiles with avatars, status, and zodiac signs
- Dark theme UI with gradient accents
- Progressive Web App (PWA) - installable on mobile/desktop
- Offline support with service worker caching
- Auto-update notifications for new versions
- Responsive design for all screen sizes

### ⚡ Performance
- Optimized bundle size with code splitting
- Efficient real-time subscriptions
- Lazy loading of media content
- Client-side encryption (no server processing)

---

## Tech Stack

### Frontend
- **React 18** - UI framework
- **Tailwind CSS** - Utility-first styling
- **Material Symbols** - Icon library

### Backend (BaaS)
- **Firebase Authentication** - Google OAuth
- **Cloud Firestore** - Real-time database
- **Firebase Storage** - Encrypted media storage
- **Firebase Hosting** - Static site deployment

### Cryptography
- **Web Crypto API** - Native browser encryption
  - `RSA-OAEP` for asymmetric encryption
  - `AES-GCM` for symmetric encryption
- **Custom Key Management** - Per-chat symmetric keys with RSA wrapping

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Service Workers** - PWA functionality

---

## Architecture & Data Flow

### Authentication Flow
```
1. User clicks "Sign in with Google"
2. Firebase Auth handles OAuth flow
3. Check if user email is in allowlist (Firestore: allowed_emails collection)
4. If allowed: Generate RSA key pair, store public key in Firestore
5. Load user profile and navigate to chat list
```

### Chat Creation Flow
```
1. User A searches for User B by email
2. Create chat document with both participants
3. Initialize unread count for both users
4. Generate random AES-256 chat key
5. Encrypt chat key with both users' RSA public keys
6. Store encrypted key packages in Firestore
```

### Message Sending Flow (E2EE)
```
1. User types message and hits send
2. Retrieve chat's AES key (decrypt with user's RSA private key)
3. Encrypt message text with AES-GCM
4. Store encrypted message + IV in Firestore
5. Update chat preview with last message
6. Increment unread count for recipient
7. Real-time listener on recipient's device receives update
8. Recipient decrypts message with chat's AES key
```

### Media Encryption Flow
```
1. User selects image/records audio
2. Read file as ArrayBuffer
3. Encrypt file with chat's AES-256 key
4. Upload encrypted blob to Firebase Storage
5. Store metadata (filePath, IV) in Firestore message
6. Recipient downloads encrypted blob
7. Decrypt with chat key and display
```

### Unread Count Management
```
Increment: When message is sent
  - Get other participant's email (lowercase)
  - Increment unreadCount[otherEmail] by 1
  - Update entire unreadCount object (avoid Firestore dot notation bug)

Reset: When user opens chat
  - Get current user's email (lowercase)
  - Set unreadCount[userEmail] to 0
  - Update entire unreadCount object
```

---

## Project Structure

```
hicu-react/
├── public/
│   ├── service-worker.js      # PWA service worker
│   ├── manifest.json           # PWA manifest
│   └── icons/                  # App icons
├── src/
│   ├── components/
│   │   ├── AudioRecorder.jsx   # Voice message recording
│   │   ├── EncryptedImage.jsx  # Decrypt and display images
│   │   └── EncryptedAudio.jsx  # Decrypt and play audio
│   ├── crypto/
│   │   ├── publicKeyManager.js # RSA key pair generation
│   │   ├── chatKeyManager.js   # AES key generation + RSA wrapping
│   │   ├── textEncryption.js   # AES-GCM text encryption
│   │   └── mediaCrypto.js      # AES-GCM file encryption
│   ├── pages/
│   │   ├── LoginPage/          # Google sign-in
│   │   ├── ChatListPage/       # Chat list with search
│   │   ├── ChatInterfacePage/  # Message thread
│   │   └── ProfilePage/        # User profile editor
│   ├── services/
│   │   ├── allowlistService.js # Check user access
│   │   ├── dmChatService.js    # Create DM chats
│   │   ├── dmChatListService.js # Subscribe to chat list
│   │   ├── chatMessagesService.js # Send/receive messages
│   │   ├── mediaUploadService.js  # Upload encrypted media
│   │   ├── messageDeleteService.js # Unsend messages
│   │   ├── readReceiptService.js   # Mark messages as read
│   │   ├── userProfileService.js   # User CRUD
│   │   └── userSearchService.js    # Search users
│   ├── firebase.js             # Firebase initialization
│   ├── App.jsx                 # Main app component
│   └── index.js                # Entry point + SW registration
├── firestore.rules             # Firestore security rules
├── storage.rules               # Storage security rules
└── package.json
```

---

## Security Model

### What's Public
- ✅ Firebase Web API configuration (by design)
- ✅ Firestore security rules
- ✅ App source code
- ✅ RSA public keys (stored in Firestore)

### What's Private
- 🔒 RSA private keys (stored in browser's IndexedDB, never uploaded)
- 🔒 AES chat keys (encrypted with RSA, only accessible to participants)
- 🔒 Message plaintext (encrypted before upload)
- 🔒 Media files (encrypted before upload)
- 🔒 Allowlist (only admins can modify via Firebase Console)

### Security Rules
**Firestore Rules:**
- Users can only read their own public key and profile
- Users can only access chats they're participants in
- Users can only create chats they're a participant in
- Message updates limited to read receipts and view-once tracking
- Message deletion only by sender or for view-once after viewing

**Storage Rules:**
- Users can only read/write media in chats they're participants in
- Encrypted filenames prevent enumeration

---

## Setup Instructions

### Prerequisites
- Node.js 16+ and npm
- Firebase project (free tier works)
- Google Cloud Console project (for OAuth)

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd hicu-react
npm install
```

### 2. Firebase Setup

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project
3. Enable Google Authentication
4. Enable Firestore Database
5. Enable Firebase Storage
6. Enable Firebase Hosting (optional)

#### Configure Firebase
1. Get your Firebase config from Project Settings
2. Update `src/firebase.js` with your config:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

#### Deploy Security Rules
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize project
firebase init

# Deploy rules
firebase deploy --only firestore:rules
firebase deploy --only storage
```

#### Create Allowlist
In Firestore, create collection `allowed_emails`:
- Add document with ID = user's email (lowercase)
- Add field `allowed: true`

Example:
```
allowed_emails/
  └── user@example.com
      └── allowed: true
```

### 3. Run Development Server
```bash
npm start
```

App runs at `http://localhost:3000`

### 4. Build for Production
```bash
npm run build
```

Outputs to `build/` directory

### 5. Deploy to Firebase Hosting
```bash
firebase deploy --only hosting
```

---

## How It Works

### Encryption Deep Dive

#### Key Generation
1. **User Registration:**
   - Generate RSA-2048 key pair using Web Crypto API
   - Store public key in Firestore (`publicKeys/{userEmail}`)
   - Store private key in browser's IndexedDB (never leaves device)

2. **Chat Creation:**
   - Generate random AES-256 key for the chat
   - Fetch both participants' RSA public keys from Firestore
   - Encrypt AES key separately for each participant using their RSA public key
   - Store both encrypted key packages in Firestore (`chats/{chatId}/keyPackages/`)

#### Message Encryption
```javascript
// Sender's device
1. Get chat's AES key (decrypt key package with own RSA private key)
2. Generate random IV (Initialization Vector)
3. Encrypt message: ciphertext = AES-GCM(plaintext, key, IV)
4. Store { encryptedText, textIv } in Firestore

// Recipient's device
1. Get chat's AES key (decrypt key package with own RSA private key)
2. Retrieve { encryptedText, textIv } from Firestore
3. Decrypt: plaintext = AES-GCM-Decrypt(ciphertext, key, IV)
4. Display plaintext
```

#### Why This Design?
- **RSA** for key exchange (asymmetric) - secure initial key sharing
- **AES-256** for messages (symmetric) - fast encryption for high-frequency operations
- **Per-chat keys** - compromising one chat doesn't affect others
- **Random IVs** - same plaintext encrypts differently each time

### Real-time Sync
- Firestore `onSnapshot` listeners for instant updates
- Automatic reconnection on network changes
- Optimistic UI updates for better UX

### PWA Features
- Service worker caches app shell for offline access
- Installable on mobile home screen
- Auto-update detection and user notification
- Background sync when back online

---

## Development

### Available Scripts
```bash
npm start          # Development server with hot reload
npm run build      # Production build
npm run lint       # Check code style
npm run lint:fix   # Auto-fix linting issues
npm run format     # Format code with Prettier
```

### Code Style
- ESLint + Prettier configuration included
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Component-based architecture
- Functional components with hooks

### Adding a New User
1. Add email to Firestore `allowed_emails` collection
2. User signs in with Google
3. App automatically generates RSA key pair on first login

---

## Troubleshooting

### "Access Denied" on Sign In
- Check if user's email is in `allowed_emails` collection (lowercase)
- Verify Firestore rules are deployed

### Messages Not Decrypting
- Check browser console for errors
- Verify user has RSA key pair (check IndexedDB)
- Ensure chat has key packages for both participants

### Media Not Loading
- Check Storage security rules are deployed
- Verify file path exists in Firebase Storage
- Check browser console for CORS errors

### Unread Count Not Working
- Ensure Firestore rules allow updating `unreadCount` field
- Check that email addresses are lowercase in `unreadCount` map
- Verify no nested objects in `unreadCount` (dot notation bug)

---

## Browser Compatibility

### Required Features
- Web Crypto API (RSA-OAEP, AES-GCM)
- IndexedDB
- Service Workers
- Media Recorder API (for voice messages)

### Supported Browsers
- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 14+
- ✅ Edge 80+
- ❌ Internet Explorer (not supported)

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Commit Message Convention
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

---

## License

MIT License - feel free to use this project for learning or as a starting point for your own secure chat app.

---

## Acknowledgments

- Firebase for backend infrastructure
- Web Crypto API for secure encryption
- Tailwind CSS for beautiful styling
- React team for the amazing framework

---

## Security Disclosure

If you discover a security vulnerability, please email the maintainer directly instead of opening a public issue.

**Remember:** This is an educational project. For production use, consider additional security measures like:
- Perfect Forward Secrecy
- Key rotation
- Security audits
- Formal threat modeling
