import { defineConfig, loadEnv } from 'vite';
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
});