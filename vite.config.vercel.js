import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [
      react({
        jsxImportSource: '@emotion/react'
      })
    ],
    // Configuración específica para evitar problemas con React en producción
    define: {
      global: 'globalThis',
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'react-router': ['react-router-dom'],
            'mui': ['@mui/material', '@mui/icons-material'],
            'emotion': ['@emotion/react', '@emotion/styled', '@emotion/cache'],
            'pdf': ['pdfjs-dist'],
            'ui': ['sweetalert2', 'notistack', 'driver.js'],
            'date': ['react-date-range', 'date-fns'],
          }
        },
       
      },
      sourcemap: false,
      minify: 'esbuild',
      // Configuración específica para Vercel
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'react': resolve(__dirname, 'node_modules/react'),
        'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@emotion/react',
        '@emotion/styled',
        '@emotion/cache'
      ],
      exclude: ['node-fetch', 'tesseract.js']
    },

  };
});
