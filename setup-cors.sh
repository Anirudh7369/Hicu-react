#!/bin/bash

# Simple script to set up CORS for Firebase Storage (SECURE - specific domains only)

echo "Setting up SECURE CORS for Firebase Storage..."

# Create cors.json with specific domains only (NO WILDCARD)
cat > cors.json << 'EOF'
[
  {
    "origin": [
      "http://localhost:3000",
      "https://hicu-eb71e.web.app",
      "https://hicu-eb71e.firebaseapp.com",
      "https://temeka-butlerlike-patrilineally.ngrok-free.dev"
    ],
    "method": ["GET", "HEAD", "OPTIONS"],
    "responseHeader": ["Content-Type", "Content-Length", "Content-Range"],
    "maxAgeSeconds": 3600
  }
]
EOF

echo "✅ Created cors.json"

# Apply CORS configuration
echo "📤 Applying CORS to Firebase Storage bucket..."
gsutil cors set cors.json gs://hicu-eb71e.firebasestorage.app

if [ $? -eq 0 ]; then
    echo "✅ CORS configuration applied successfully!"
    echo ""
    echo "🧪 Test your app now - images should work!"
else
    echo "❌ Failed to apply CORS. You may need to authenticate first:"
    echo "   Run: gcloud auth login"
    echo "   Then run this script again"
fi

# Clean up
rm cors.json
