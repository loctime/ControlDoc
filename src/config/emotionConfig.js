// Configuración adicional para Emotion
// Soluciona problemas de compatibilidad con Vite

import { CacheProvider } from '@emotion/react';
import { emotionCache } from './emotionSetup';

// Wrapper para Emotion que asegura compatibilidad
export const EmotionProvider = ({ children }) => {
  return (
    <CacheProvider value={emotionCache}>
      {children}
    </CacheProvider>
  );
};

// Función para verificar que styled esté disponible
export const ensureStyledAvailable = () => {
  if (typeof window !== 'undefined') {
    // Verificar que Emotion esté cargado
    const emotionStyles = document.querySelectorAll('[data-emotion]');
    if (emotionStyles.length === 0) {
      console.warn('Emotion no está funcionando correctamente');
      return false;
    }
  }
  return true;
};

// Configuración global para evitar errores
if (typeof window !== 'undefined') {
  // Asegurar que Emotion esté disponible globalmente
  window.__EMOTION_CACHE__ = emotionCache;
}
