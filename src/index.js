import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA functionality with update detection
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('✅ SW Registration: Registered at', registration.scope);

        // Store registration globally so App.jsx can access it
        window.__swRegistration = registration;

        // Check for updates every 10 seconds (more frequent for faster detection)
        setInterval(() => {
          console.log('🔍 SW Check: Looking for updates...');
          registration.update();
        }, 10000);

        // Also check when page becomes visible (important for mobile)
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            console.log('👀 SW Check: Page visible, checking for updates...');
            registration.update();
          }
        });

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('🆕 SW Update: Found new version! Installing...');

          newWorker.addEventListener('statechange', () => {
            console.log('🔄 SW State:', newWorker.state);

            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is installed and waiting
              console.log('✅ SW Ready: New version installed and waiting');
              console.log('📦 SW Stored: Waiting worker reference stored');

              // Store waiting worker globally so App.jsx can access it
              window.__waitingServiceWorker = newWorker;

              // Dispatch custom event to notify the app
              const event = new CustomEvent('sw-update-available', {
                detail: { waitingWorker: newWorker }
              });
              window.dispatchEvent(event);
              console.log('📢 SW Event: Dispatched update-available event');
            }
          });
        });
      })
      .catch((error) => {
        console.error('❌ SW Registration: Failed -', error);
      });

    // Listen for controller change (when new SW takes over)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('🔄 SW Control: New service worker activated');
        console.log('🔃 SW Reload: Reloading page in 100ms...');
        // Small delay to ensure state is updated
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
    });
  });
}
