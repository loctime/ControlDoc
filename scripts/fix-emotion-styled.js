#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Script para solucionar el error "styled_default is not a function"
 * Este error ocurre cuando Emotion no se configura correctamente con Vite
 */

console.log('🔧 Solucionando error de Emotion styled...');

// 1. Verificar y corregir vite.config.js
const viteConfigPath = resolve(process.cwd(), 'vite.config.js');
let viteConfig = readFileSync(viteConfigPath, 'utf8');

// Verificar si ya tiene la configuración correcta
if (!viteConfig.includes('@emotion/babel-plugin')) {
  console.log('📝 Actualizando vite.config.js...');
  
  // Reemplazar la configuración de React
  const newReactConfig = `react({
        jsxImportSource: '@emotion/react',
        babel: {
          plugins: [
            ['@emotion/babel-plugin', { 
              sourceMap: mode === 'development',
              autoLabel: 'dev-only',
              labelFormat: '[local]'
            }]
          ]
        }
      })`;
  
  viteConfig = viteConfig.replace(
    /react\(\{[^}]*\}\)/s,
    newReactConfig
  );
  
  writeFileSync(viteConfigPath, viteConfig);
  console.log('✅ vite.config.js actualizado');
} else {
  console.log('✅ vite.config.js ya está configurado correctamente');
}

// 2. Verificar y corregir main.jsx
const mainJsxPath = resolve(process.cwd(), 'src/main.jsx');
let mainJsx = readFileSync(mainJsxPath, 'utf8');

// Verificar si ya tiene la configuración correcta
if (!mainJsx.includes('import { CacheProvider }')) {
  console.log('📝 Actualizando main.jsx...');
  
  // Asegurar que las importaciones estén correctas
  const imports = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { CacheProvider } from '@emotion/react';
import App from './App.jsx';
import './index.css';
import { SnackbarProvider } from 'notistack';
import { emotionCache } from './config/emotionSetup';
import './config/reactGlobal.js'; // Configuración global de React
import './config/reactSetup.js'; // Configuración específica de React`;
  
  // Reemplazar las importaciones
  mainJsx = mainJsx.replace(
    /import React from 'react';\s*import ReactDOM from 'react-dom\/client';\s*import \{ CacheProvider \} from '@emotion\/react';\s*import App from '\.\/App\.jsx';\s*import '\.\/index\.css';\s*import \{ SnackbarProvider \} from 'notistack';\s*import \{ emotionCache \} from '\.\/config\/emotionSetup';\s*import '\.\/config\/reactGlobal\.js';\s*import '\.\/config\/reactSetup\.js';/s,
    imports
  );
  
  writeFileSync(mainJsxPath, mainJsx);
  console.log('✅ main.jsx actualizado');
} else {
  console.log('✅ main.jsx ya está configurado correctamente');
}

// 3. Verificar y corregir emotionSetup.js
const emotionSetupPath = resolve(process.cwd(), 'src/config/emotionSetup.js');
let emotionSetup = readFileSync(emotionSetupPath, 'utf8');

// Verificar si ya tiene la configuración correcta
if (!emotionSetup.includes('prepend: true')) {
  console.log('📝 Actualizando emotionSetup.js...');
  
  const newEmotionSetup = `// Configuración simple y robusta para Emotion
// Evita el error "styled_default is not a function" en producción

import createCache from '@emotion/cache';

// Configuración básica y estable para Emotion
export const createEmotionCache = () => {
  return createCache({
    key: 'emotion-cache',
    prepend: true,
    speedy: false,
    // Configuración adicional para evitar errores
    insertionPoint: typeof document !== 'undefined' ? document.querySelector('meta[name="emotion-insertion-point"]') : undefined
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
};`;
  
  writeFileSync(emotionSetupPath, newEmotionSetup);
  console.log('✅ emotionSetup.js actualizado');
} else {
  console.log('✅ emotionSetup.js ya está configurado correctamente');
}

// 4. Crear archivo de configuración adicional para Emotion
const emotionConfigPath = resolve(process.cwd(), 'src/config/emotionConfig.js');
const emotionConfig = `// Configuración adicional para Emotion
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
`;

writeFileSync(emotionConfigPath, emotionConfig);
console.log('✅ emotionConfig.js creado');

console.log('🎉 Configuración de Emotion completada!');
console.log('💡 Si el error persiste, reinicia el servidor de desarrollo');
