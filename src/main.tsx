import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App';
import './index.css';

/**
 * API URL Strategy:
 * We run this immediately before rendering to ensure the base URL 
 * is set in sessionStorage for the api.ts utility to pick up.
 */
(function autoConfigureApiUrl() {
  const isElectron = navigator.userAgent.toLowerCase().includes('electron') || 
                     window.location.protocol === 'file:';
                     
  if (isElectron) {
    // Electron desktop app: talk directly to the embedded server.
    // Using 127.0.0.1 is often more stable than 'localhost' in Electron.
    sessionStorage.setItem('api_base_url', 'http://127.0.0.1:3001/api');
  } else {
    // Web browser: use relative URL, Vite proxy handles routing.
    sessionStorage.setItem('api_base_url', '/api');
  }
})();

// ONLY ONE createRoot call. 
// We do NOT wrap it in HashRouter here because your App.tsx already has HashRouter.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);