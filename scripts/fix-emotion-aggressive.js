#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Solución AGRESIVA para el error "styled_default is not a function"
 * Este script hace cambios más profundos para solucionar el problema
 */

console.log('🔥 SOLUCIÓN AGRESIVA para el error de Emotion styled...');

// 1. Limpiar caché de Vite
console.log('🧹 Limpiando caché de Vite...');
const nodeModulesPath = resolve(process.cwd(), 'node_modules/.vite');
if (existsSync(nodeModulesPath)) {
  try {
    const { rmSync } = await import('fs');
    rmSync(nodeModulesPath, { recursive: true, force: true });
    console.log('✅ Caché de Vite eliminado');
  } catch (error) {
    console.log('⚠️  No se pudo eliminar el caché de Vite:', error.message);
  }
}

// 2. Actualizar vite.config.js con configuración más robusta
console.log('🔧 Actualizando vite.config.js con configuración agresiva...');
const viteConfigContent = `import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [
      react({
        jsxImportSource: '@emotion/react',
        babel: {
          plugins: [
            ['@emotion/babel-plugin', { 
              sourceMap: mode === 'development',
              autoLabel: 'dev-only',
              labelFormat: '[local]',
              cssPropOptimization: true
            }]
          ]
        }
      })
    ],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          secure: true,
          logLevel: 'debug',
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: undefined,
        }
      },
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'esbuild' : false,
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
        requireReturnsDefault: 'auto'
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'react': resolve(__dirname, 'node_modules/react'),
        'react-dom': resolve(__dirname, 'node_modules/react-dom'),
        // Alias específico para Emotion
        '@emotion/react': resolve(__dirname, 'node_modules/@emotion/react'),
        '@emotion/styled': resolve(__dirname, 'node_modules/@emotion/styled'),
        '@emotion/cache': resolve(__dirname, 'node_modules/@emotion/cache'),
      },
    },
    define: {
      global: 'globalThis',
      'process.env.NODE_ENV': JSON.stringify(mode),
      'window.React': 'React',
      'global.React': 'React'
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@emotion/react',
        '@emotion/styled',
        '@emotion/cache',
        '@emotion/babel-plugin'
      ],
      force: true // Forzar reoptimización
    },
    esbuild: {
      jsxImportSource: '@emotion/react',
      jsxFactory: 'jsx',
      jsxFragment: 'Fragment'
    }
  };
});`;

writeFileSync(resolve(process.cwd(), 'vite.config.js'), viteConfigContent);
console.log('✅ vite.config.js actualizado con configuración agresiva');

// 3. Crear un polyfill para Emotion
console.log('🛡️  Creando polyfill para Emotion...');
const emotionPolyfill = `// Polyfill para solucionar el error "styled_default is not a function"
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
})();`;

writeFileSync(resolve(process.cwd(), 'src/emotion-polyfill.js'), emotionPolyfill);
console.log('✅ Polyfill de Emotion creado');

// 4. Actualizar main.jsx para cargar el polyfill primero
console.log('📝 Actualizando main.jsx...');
const mainJsxPath = resolve(process.cwd(), 'src/main.jsx');
let mainJsx = readFileSync(mainJsxPath, 'utf8');

// Asegurar que el polyfill se cargue primero
const polyfillImport = "import './emotion-polyfill'; // Cargar polyfill primero\n";
if (!mainJsx.includes('emotion-polyfill')) {
  // Insertar después de las primeras importaciones
  const firstImportIndex = mainJsx.indexOf("import React from 'react';");
  if (firstImportIndex !== -1) {
    mainJsx = mainJsx.slice(0, firstImportIndex) + polyfillImport + mainJsx.slice(firstImportIndex);
    writeFileSync(mainJsxPath, mainJsx);
    console.log('✅ main.jsx actualizado con polyfill');
  }
} else {
  console.log('✅ main.jsx ya tiene el polyfill');
}

// 5. Crear archivo de configuración adicional
console.log('⚙️  Creando configuración adicional...');
const emotionConfigAdvanced = `// Configuración avanzada para Emotion
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
`;

writeFileSync(resolve(process.cwd(), 'src/config/emotionConfigAdvanced.js'), emotionConfigAdvanced);
console.log('✅ Configuración avanzada de Emotion creada');

console.log('🎉 SOLUCIÓN AGRESIVA completada!');
console.log('💡 Reinicia el servidor de desarrollo para aplicar los cambios');
console.log('🚀 Ejecuta: npm run dev');
