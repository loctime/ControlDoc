// Cache buster - generado automáticamente
// Timestamp: 1769882275951
console.log('🔄 Cache buster activado:', 1769882275951);

// Forzar recarga de Emotion
if (typeof window !== 'undefined') {
  // Limpiar caché de Emotion
  if (window.__EMOTION_CACHE__) {
    window.__EMOTION_CACHE__.registered = {};
    window.__EMOTION_CACHE__.inserted = {};
  }
  
  // Limpiar estilos existentes
  const emotionStyles = document.querySelectorAll('[data-emotion]');
  emotionStyles.forEach(style => {
    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }
  });
  
  console.log('🧹 Caché de Emotion limpiado');
}