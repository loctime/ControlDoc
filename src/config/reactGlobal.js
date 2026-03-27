// Configuración global para React
// Asegura que React esté disponible en todos los contextos

import * as React from 'react';
import * as ReactDOM from 'react-dom';

// Hacer React disponible globalmente de forma más robusta
if (typeof window !== 'undefined') {
  window.React = React;
  window.ReactDOM = ReactDOM;
  
  // Asegurar que todos los hooks estén disponibles
  window.useState = React.useState;
  window.useEffect = React.useEffect;
  window.useContext = React.useContext;
  window.useRef = React.useRef;
  window.useCallback = React.useCallback;
  window.useMemo = React.useMemo;
  window.useReducer = React.useReducer;
  window.useLayoutEffect = React.useLayoutEffect;
}

// Asegurar que React esté disponible en el contexto global
if (typeof global !== 'undefined') {
  global.React = React;
  global.useState = React.useState;
  global.useEffect = React.useEffect;
  global.useContext = React.useContext;
  global.useRef = React.useRef;
  global.useCallback = React.useCallback;
  global.useMemo = React.useMemo;
  global.useReducer = React.useReducer;
  global.useLayoutEffect = React.useLayoutEffect;
}

// Exportar React para uso en otros archivos
export default React;
export { React };
