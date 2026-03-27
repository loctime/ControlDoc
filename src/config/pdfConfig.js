// src/config/pdfConfig.js
// FEATURE FLAG: Desactivar PDF.js temporalmente para evitar crash
const PDFJS_ENABLED = false; // Cambiar a true cuando se solucione el problema

let pdfjsLib = null;

const applyAggressivePdfFontWarningSuppression = () => {
  const isFontWarning = (message) => {
    const lowerMessage = message.toLowerCase();
    return (
      lowerMessage.includes('arialroundedmtbold') ||
      lowerMessage.includes('arialroundedmt') ||
      lowerMessage.includes('arialroundedmtpro') ||
      lowerMessage.includes('cannot load system font') ||
      lowerMessage.includes('installing it could help') ||
      lowerMessage.includes('pdf rendering')
    );
  };

  const originalWarn = console.warn;
  console.warn = function(...args) {
    const message = args.join(' ');
    if (isFontWarning(message)) {
      return;
    }
    originalWarn.apply(console, args);
  };

  const originalError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    if (isFontWarning(message)) {
      return;
    }
    originalError.apply(console, args);
  };

  const originalLog = console.log;
  console.log = function(...args) {
    const message = args.join(' ');
    if (isFontWarning(message)) {
      return;
    }
    originalLog.apply(console, args);
  };

  if (typeof window !== 'undefined') {
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = function(type, listener, options) {
      if (type === 'message') {
        const wrappedListener = function(event) {
          if (event.data) {
            let dataString = '';
            try {
              dataString = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
            } catch (e) {
              dataString = String(event.data);
            }

            if (isFontWarning(dataString)) {
              return;
            }
          }
          listener.call(this, event);
        };
        return originalAddEventListener.call(this, type, wrappedListener, options);
      }
      return originalAddEventListener.call(this, type, listener, options);
    };

    const originalPostMessage = window.postMessage;
    window.postMessage = function(message, targetOrigin, transfer) {
      let messageString = '';
      try {
        messageString = typeof message === 'string' ? message : JSON.stringify(message);
      } catch (e) {
        messageString = String(message);
      }

      if (isFontWarning(messageString)) {
        return;
      }
      originalPostMessage.call(this, message, targetOrigin, transfer);
    };

    if (window.onmessage) {
      const originalOnMessage = window.onmessage;
      window.onmessage = function(event) {
        if (event.data) {
          let dataString = '';
          try {
            dataString = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
          } catch (e) {
            dataString = String(event.data);
          }

          if (isFontWarning(dataString)) {
            return;
          }
        }
        originalOnMessage.call(this, event);
      };
    }

    const originalDefineProperty = Object.defineProperty;
    Object.defineProperty = function(obj, prop, descriptor) {
      if (prop === 'onmessage' && descriptor.value) {
        const originalValue = descriptor.value;
        descriptor.value = function(event) {
          if (event.data) {
            let dataString = '';
            try {
              dataString = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
            } catch (e) {
              dataString = String(event.data);
            }

            if (isFontWarning(dataString)) {
              return;
            }
          }
          originalValue.call(this, event);
        };
      }
      return originalDefineProperty.call(this, obj, prop, descriptor);
    };
  }
};

// Función asíncrona autoejecutable para configurar PDF.js
(async () => {
  if (PDFJS_ENABLED) {
    try {
      applyAggressivePdfFontWarningSuppression();
      // Import dinámico solo si está habilitado
      const pdfjsModule = await import('pdfjs-dist/build/pdf');
      pdfjsLib = pdfjsModule.default;

      // Suprimir advertencias específicas de fuentes de manera más robusta
      const suppressFontWarnings = () => {
        // Suprimir en el contexto principal
        const originalWarn = console.warn;
        console.warn = function(...args) {
          const message = args.join(' ');
          // Suprimir advertencias de fuentes específicas que pueden causar problemas
          if ((message.includes('ArialRoundedMTBold') || 
               message.includes('ArialRoundedMT') ||
               message.includes('ArialRoundedMTPro') ||
               message.includes('system font')) && 
              (message.includes('installing it could help') || 
               message.includes('Cannot load system font'))) {
            // No mostrar estas advertencias específicas
            return;
          }
          // Mostrar todas las demás advertencias normalmente
          originalWarn.apply(console, args);
        };
      };

      // Configuración del worker de PDF.js simplificada
      const configurePDFWorker = () => {
        try {
          // Usar el worker estándar con configuración mejorada
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
          console.log('✅ PDF.js worker configurado correctamente');
        } catch (error) {
          console.error('❌ Error configurando PDF.js worker:', error);
          // Fallback final
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
      };

      // Configurar fallbacks de fuentes de forma más efectiva
      const configureFontFallbacks = () => {
        // Configurar fallbacks globales para PDF.js
        if (typeof window !== 'undefined') {
          // Crear un estilo CSS global para fallbacks de fuentes
          const style = document.createElement('style');
          style.textContent = `
            /* Fallbacks para fuentes que pueden no estar disponibles */
            @font-face {
              font-family: 'ArialRoundedMTBold';
              src: local('Arial-Bold'), local('Arial Bold'), local('Arial'), local('Helvetica-Bold'), local('Helvetica'), local('sans-serif');
              font-weight: bold;
              font-style: normal;
            }
            
            @font-face {
              font-family: 'ArialRoundedMT';
              src: local('Arial'), local('Helvetica'), local('sans-serif');
              font-weight: normal;
              font-style: normal;
            }
            
            @font-face {
              font-family: 'ArialRoundedMTPro';
              src: local('Arial'), local('Helvetica'), local('sans-serif');
              font-weight: normal;
              font-style: normal;
            }
            
            /* Fallbacks adicionales para otras fuentes problemáticas */
            @font-face {
              font-family: 'ArialRoundedMTPro-Bold';
              src: local('Arial-Bold'), local('Arial Bold'), local('Arial'), local('Helvetica-Bold'), local('Helvetica'), local('sans-serif');
              font-weight: bold;
              font-style: normal;
            }
            
            @font-face {
              font-family: 'ArialRoundedMTPro-Regular';
              src: local('Arial'), local('Helvetica'), local('sans-serif');
              font-weight: normal;
              font-style: normal;
            }
            
            /* Configuración global para mejorar el renderizado de texto */
            canvas {
              image-rendering: -webkit-optimize-contrast;
              image-rendering: crisp-edges;
              text-rendering: optimizeLegibility;
            }
          `;
          
          // Agregar el estilo al head del documento
          document.head.appendChild(style);
          console.log('📝 Fallbacks de fuentes configurados globalmente');
        }
      };

      // Configurar opciones globales de PDF.js para mejor compatibilidad
      const configurePDFOptions = () => {
        // Configurar opciones globales para mejorar el renderizado
        if (pdfjsLib.GlobalWorkerOptions) {
          // Configurar opciones para mejor manejo de fuentes
          pdfjsLib.GlobalWorkerOptions.verbosity = 0; // Reducir verbosidad
        }
        
        // Configurar opciones de renderizado por defecto
        if (typeof window !== 'undefined') {
          window.PDFJS_RENDER_OPTIONS = {
            enableWebGL: false, // Deshabilitar WebGL para mejor compatibilidad
            renderInteractiveForms: false, // Deshabilitar formularios interactivos si no se necesitan
            useSystemFonts: true, // Usar fuentes del sistema
          };
        }
      };

      // Función para interceptar y filtrar mensajes del worker de manera más robusta
      const interceptWorkerMessages = () => {
        if (typeof window !== 'undefined') {
          // Interceptar mensajes del worker de manera más simple
          const originalAddEventListener = window.addEventListener;
          window.addEventListener = function(type, listener, options) {
            if (type === 'message') {
              const wrappedListener = function(event) {
                // Filtrar mensajes de advertencia de fuentes del worker
                if (event.data && typeof event.data === 'object') {
                  // Verificar si es un mensaje de consola
                  if (event.data.type === 'console' && event.data.method === 'warn') {
                    const warnMessage = event.data.data ? event.data.data.join(' ') : '';
                    if ((warnMessage.includes('ArialRoundedMTBold') || 
                         warnMessage.includes('ArialRoundedMT') ||
                         warnMessage.includes('ArialRoundedMTPro') ||
                         warnMessage.includes('system font')) && 
                        (warnMessage.includes('installing it could help') || 
                         warnMessage.includes('Cannot load system font'))) {
                      // No procesar este mensaje de advertencia
                      return;
                    }
                  }
                  // También verificar mensajes directos del worker
                  else if (event.data.source && event.data.source.includes('pdfjs')) {
                    const dataString = JSON.stringify(event.data);
                    if ((dataString.includes('ArialRoundedMTBold') || 
                         dataString.includes('ArialRoundedMT') ||
                         dataString.includes('ArialRoundedMTPro') ||
                         dataString.includes('system font')) && 
                        (dataString.includes('installing it could help') || 
                         dataString.includes('Cannot load system font'))) {
                      // No procesar este mensaje de advertencia
                      return;
                    }
                  }
                }
                listener.call(this, event);
              };
              return originalAddEventListener.call(this, type, wrappedListener, options);
            }
            return originalAddEventListener.call(this, type, listener, options);
          };
        }
      };

      // Aplicar supresión de advertencias ANTES de configurar PDF.js
      suppressFontWarnings();

      // Interceptar mensajes del worker
      interceptWorkerMessages();

      // Configurar el worker
      configurePDFWorker();

      // Configurar fallbacks de fuentes
      configureFontFallbacks();

      // Configurar opciones adicionales
      configurePDFOptions();

      console.log('✅ PDF.js configurado correctamente');
    } catch (error) {
      console.error('❌ Error configurando PDF.js:', error);
      pdfjsLib = null;
    }
  } else {
    console.log('🚫 PDF.js está desactivado temporalmente para evitar crash');
  }
})();

export { pdfjsLib, PDFJS_ENABLED };
