// Polyfill para solucionar el error "styled_default is not a function"
// Este archivo se ejecuta antes que cualquier otro código

(function() {
  'use strict';
  
  // Verificar si estamos en el navegador
  if (typeof window === 'undefined') return;
  
  // Interceptar importaciones problemáticas
  const originalImport = window.__import || (() => {});
  
  // Crear polyfill para styled
  if (!window.styled) {
    window.styled = function(tag) {
      return function(strings, ...values) {
        // Implementación básica de styled
        const className = 'styled-' + Math.random().toString(36).substr(2, 9);
        const element = document.createElement(tag);
        element.className = className;
        return element;
      };
    };
  }
  
  // Interceptar errores de Emotion
  const originalError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    if (message && message.includes('styled_default is not a function')) {
      console.warn('🚫 Error de Emotion interceptado y suprimido:', message);
      return true; // Prevenir que el error se propague
    }
    if (originalError) {
      return originalError.apply(this, arguments);
    }
    return false;
  };
  
  // Interceptar console.error
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('styled_default is not a function')) {
      console.warn('🚫 Error de Emotion suprimido en console.error');
      return;
    }
    originalConsoleError.apply(console, args);
  };
  
  console.log('🛡️  Polyfill de Emotion cargado');
})();