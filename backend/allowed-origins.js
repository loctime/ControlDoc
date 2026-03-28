// backend/allowed-origins.js
// Orígenes extra: CORS_EXTRA_HOSTNAMES=app.ejemplo.com,otro.com (hostnames, separados por coma)

const EXTRA_HOSTNAMES = (process.env.CORS_EXTRA_HOSTNAMES || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function matchesExtraHostname(hostname) {
  const h = hostname.toLowerCase();
  return EXTRA_HOSTNAMES.some(
    (allowed) => h === allowed || h.endsWith(`.${allowed}`)
  );
}

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
        hostname.endsWith('.onrender.com') ||
        matchesExtraHostname(hostname)
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
  