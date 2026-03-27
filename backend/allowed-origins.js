// backend/allowed-origins.js

export function isAllowedOrigin(origin) {
    if (!origin) {
      // Permitir herramientas como Postman, curl, etc. (sin origin)
      return true;
    }
  
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      
      // Log para debugging (solo en desarrollo o cuando hay problemas)
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CORS) {
        console.log(`🔍 [CORS] Verificando origen: ${origin} -> hostname: ${hostname}`);
      }
  
      const isAllowed = (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === 'controldoc.app' ||
        hostname === 'www.controldoc.app' ||
        hostname.endsWith('.controldoc.app') ||
        hostname.endsWith('.vercel.app') ||
        hostname.endsWith('.onrender.com')
      );
      
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CORS) {
        console.log(`🔍 [CORS] Resultado para ${hostname}: ${isAllowed ? '✅ PERMITIDO' : '❌ BLOQUEADO'}`);
      }
      
      return isAllowed;
    } catch (error) {
      console.warn(`⚠️ [CORS] Error parseando origen "${origin}":`, error.message);
      return false;
    }
  }
  