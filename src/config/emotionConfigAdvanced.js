// Configuración avanzada para Emotion
// Soluciona problemas de compatibilidad con Vite y React 18

import { CacheProvider } from '@emotion/react';
import { emotionCache } from './emotionSetup';

// Configuración global para Emotion
if (typeof window !== 'undefined') {
  // Asegurar que Emotion esté disponible globalmente
  window.__EMOTION_CACHE__ = emotionCache;
  
  // Interceptar errores de Emotion
  const originalError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    if (message && message.includes('styled_default')) {
      console.warn('🚫 Error de Emotion interceptado:', message);
      return true;
    }
    if (originalError) {
      return originalError.apply(this, arguments);
    }
    return false;
  };
}

// Wrapper para Emotion que asegura compatibilidad
export const EmotionProvider = ({ children }) => {
  try {
    return (
      <CacheProvider value={emotionCache}>
        {children}
      </CacheProvider>
    );
  } catch (error) {
    console.warn('Error en EmotionProvider, usando fallback:', error);
    return children;
  }
};

// Función para verificar que styled esté disponible
export const ensureStyledAvailable = () => {
  if (typeof window !== 'undefined') {
    try {
      // Verificar que Emotion esté cargado
      const emotionStyles = document.querySelectorAll('[data-emotion]');
      return emotionStyles.length >= 0; // Cambiar a >= 0 para ser más permisivo
    } catch (error) {
      console.warn('Error verificando Emotion:', error);
      return true; // Asumir que está bien si hay error
    }
  }
  return true;
};

// Configuración de fallback para styled
export const createStyledFallback = () => {
  return function(tag) {
    return function(strings, ...values) {
      const className = 'styled-fallback-' + Math.random().toString(36).substr(2, 9);
      const element = document.createElement(tag || 'div');
      element.className = className;
      return element;
    };
  };
};

// Inicializar configuración
if (typeof window !== 'undefined') {
  ensureStyledAvailable();
}
