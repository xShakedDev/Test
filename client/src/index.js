import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA and handle updates automatically
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration);

        // Check for updates immediately and then every hour
        registration.update();
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Listen for service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New service worker is ready, reload the page to activate it
                console.log('New service worker available, reloading...');
                // Small delay to ensure the new worker is fully ready
                setTimeout(() => {
                  window.location.reload();
                }, 100);
              } else {
                // First time installation
                console.log('Service worker installed for the first time');
              }
            }
          });
        });
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });

    // Listen for controller change (when new service worker takes control)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        // Reload the page when a new service worker takes control
        console.log('Service worker controller changed, reloading...');
        window.location.reload();
      }
    });
  });
}
