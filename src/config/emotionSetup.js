// Configuración simple y robusta para Emotion
// Evita el error "Ke is not a constructor" en producción

import createCache from '@emotion/cache';

// Configuración básica y estable para Emotion
export const createEmotionCache = () => {
  return createCache({
    key: 'emotion-cache',
    prepend: true,
    speedy: false
  });
};

// Cache principal de la aplicación
export const emotionCache = createEmotionCache();

// Función para verificar que Emotion esté funcionando
export const checkEmotionStatus = () => {
  if (typeof window !== 'undefined') {
    try {
      const emotionStyles = document.querySelectorAll('[data-emotion]');
      return emotionStyles.length > 0;
    } catch (error) {
      console.warn('Emotion status check failed:', error);
      return false;
    }
  }
  return false;
};
