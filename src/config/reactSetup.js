// Configuración global para React
// Asegura que React esté disponible en todos los contextos

import * as React from 'react';

// Hacer React disponible globalmente
if (typeof window !== 'undefined') {
  window.React = React;
}

// Asegurar que React esté disponible en el contexto global
if (typeof global !== 'undefined') {
  global.React = React;
}

// Exportar React para uso en otros archivos
export default React;
export { React };
