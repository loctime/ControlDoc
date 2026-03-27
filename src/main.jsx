import './cache-buster'; // Cache buster
import './emotion-polyfill'; // Cargar polyfill primero
import './bootstrap/browserGlobals'; // Configuración global del browser
import React from 'react';
import ReactDOM from 'react-dom/client';
import { CacheProvider } from '@emotion/react';
import App from './App.jsx';
import './index.css';
import { SnackbarProvider } from 'notistack';
import { emotionCache } from './config/emotionSetup';
import './config/reactGlobal.js'; // Configuración global de React
import './config/reactSetup.js'; // Configuración específica de React
import { getCurrentTenantId } from './utils/tenantUtils';

// Enviar x-tenant en todas las peticiones a la API para consistencia multi-tenant (backend resuelve tenant por este header primero)
const apiBase = import.meta.env.VITE_API_URL || '';
const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  if (apiBase && typeof url === 'string' && url.startsWith(apiBase)) {
    const tenantId = getCurrentTenantId();
    if (tenantId) {
      const headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers || {});
      headers.set('X-Tenant', tenantId);
      options = { ...options, headers };
    }
  }
  return originalFetch.call(this, url, options);
};

// 🗑️ DESREGISTRAR Y PREVENIR SERVICE WORKERS (PWA removido)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // Desregistrar todos los service workers existentes
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister().then(success => {
        if (success) {
          console.log('✅ Service Worker desregistrado exitosamente');
        }
      }).catch(err => {
        console.warn('⚠️ Error al desregistrar Service Worker:', err);
      });
    });
  });

  // Prevenir registro de nuevos service workers
  const originalRegister = navigator.serviceWorker.register;
  navigator.serviceWorker.register = function() {
    console.warn('⚠️ Intento de registrar Service Worker bloqueado (PWA deshabilitado)');
    return Promise.reject(new Error('Service Worker registration is disabled'));
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CacheProvider value={emotionCache}>
      <SnackbarProvider 
        maxSnack={3} 
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }} 
        autoHideDuration={3000}
      >
        <App />
      </SnackbarProvider>
    </CacheProvider>
  </React.StrictMode>,
);
